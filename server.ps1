param(
  [int]$Port = 4176,
  [switch]$LocalOnly,
  [int]$ProviderTimeoutSeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$workDirectory = Join-Path $root "work"
$logPath = Join-Path $workDirectory "server.log"

New-Item -ItemType Directory -Force -Path $workDirectory | Out-Null

. (Join-Path $root "lib\api-client.ps1")
if ($ProviderTimeoutSeconds -gt 0) {
  $script:DefaultTimeoutSeconds = [Math]::Min(600, [Math]::Max(1, $ProviderTimeoutSeconds))
}

function Write-ServerLog {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Find-ByteSequence {
  param(
    [byte[]]$Haystack,
    [byte[]]$Needle,
    [int]$Start = 0
  )

  if ($Needle.Length -eq 0 -or $Haystack.Length -lt $Needle.Length) {
    return -1
  }

  for ($i = $Start; $i -le ($Haystack.Length - $Needle.Length); $i++) {
    $matched = $true
    for ($j = 0; $j -lt $Needle.Length; $j++) {
      if ($Haystack[$i + $j] -ne $Needle[$j]) {
        $matched = $false
        break
      }
    }
    if ($matched) {
      return $i
    }
  }

  return -1
}

function Read-HttpRequest {
  param([System.Net.Sockets.NetworkStream]$Stream)

  $headerEnd = [byte[]](13, 10, 13, 10)
  $buffer = [System.Collections.Generic.List[byte]]::new()
  $chunk = New-Object byte[] 8192
  $separatorIndex = -1

  while ($separatorIndex -lt 0) {
    $read = $Stream.Read($chunk, 0, $chunk.Length)
    if ($read -le 0) {
      return $null
    }
    for ($i = 0; $i -lt $read; $i++) {
      $buffer.Add($chunk[$i])
    }
    if ($buffer.Count -gt 1048576) {
      throw "请求头过大。"
    }
    $separatorIndex = Find-ByteSequence -Haystack $buffer.ToArray() -Needle $headerEnd
  }

  $allBytes = $buffer.ToArray()
  $headerBytes = New-Object byte[] $separatorIndex
  [Array]::Copy($allBytes, 0, $headerBytes, 0, $separatorIndex)
  $headerText = [System.Text.Encoding]::ASCII.GetString($headerBytes)
  $lines = $headerText -split "`r`n"
  $requestLine = $lines[0] -split " "

  if ($requestLine.Count -lt 3) {
    throw "请求行格式不正确。"
  }

  $headers = @{}
  for ($i = 1; $i -lt $lines.Count; $i++) {
    $colon = $lines[$i].IndexOf(":")
    if ($colon -gt 0) {
      $name = $lines[$i].Substring(0, $colon).Trim().ToLowerInvariant()
      $value = $lines[$i].Substring($colon + 1).Trim()
      $headers[$name] = $value
    }
  }

  $contentLength = 0
  if ($headers.ContainsKey("content-length")) {
    [void][int]::TryParse($headers["content-length"], [ref]$contentLength)
  }

  $bodyStart = $separatorIndex + 4
  $bodyBytes = [System.Collections.Generic.List[byte]]::new()
  for ($i = $bodyStart; $i -lt $allBytes.Length; $i++) {
    $bodyBytes.Add($allBytes[$i])
  }

  while ($bodyBytes.Count -lt $contentLength) {
    $remaining = $contentLength - $bodyBytes.Count
    $readSize = [Math]::Min($chunk.Length, $remaining)
    $read = $Stream.Read($chunk, 0, $readSize)
    if ($read -le 0) {
      break
    }
    for ($i = 0; $i -lt $read; $i++) {
      $bodyBytes.Add($chunk[$i])
    }
  }

  return [pscustomobject]@{
    Method = $requestLine[0].ToUpperInvariant()
    Target = $requestLine[1]
    Headers = $headers
    Body = [System.Text.Encoding]::UTF8.GetString($bodyBytes.ToArray())
  }
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [byte[]]$Body,
    [hashtable]$ExtraHeaders = @{}
  )

  $reason = switch ($StatusCode) {
    200 { "OK" }
    204 { "No Content" }
    400 { "Bad Request" }
    401 { "Unauthorized" }
    403 { "Forbidden" }
    404 { "Not Found" }
    405 { "Method Not Allowed" }
    408 { "Request Timeout" }
    409 { "Conflict" }
    413 { "Payload Too Large" }
    422 { "Unprocessable Content" }
    429 { "Too Many Requests" }
    451 { "Unavailable For Legal Reasons" }
    500 { "Internal Server Error" }
    502 { "Bad Gateway" }
    503 { "Service Unavailable" }
    504 { "Gateway Timeout" }
    default { "Request Failed" }
  }

  $headers = [System.Text.StringBuilder]::new()
  [void]$headers.Append("HTTP/1.1 $StatusCode $reason`r`n")
  [void]$headers.Append("Content-Type: $ContentType`r`n")
  [void]$headers.Append("Content-Length: $($Body.Length)`r`n")
  [void]$headers.Append("Connection: close`r`n")
  [void]$headers.Append("Cache-Control: no-store`r`n")
  [void]$headers.Append("X-Content-Type-Options: nosniff`r`n")
  [void]$headers.Append("Referrer-Policy: no-referrer`r`n")
  if (-not $ExtraHeaders.ContainsKey("Content-Security-Policy")) {
    [void]$headers.Append("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`r`n")
  }
  foreach ($key in $ExtraHeaders.Keys) {
    [void]$headers.Append("$key`: $($ExtraHeaders[$key])`r`n")
  }
  [void]$headers.Append("`r`n")

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers.ToString())
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

function Send-Json {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    $Payload
  )

  $json = $Payload | ConvertTo-Json -Depth 10 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Send-Response -Stream $Stream -StatusCode $StatusCode -ContentType "application/json; charset=utf-8" -Body $bytes
}

function Get-RequestPropertyValue {
  param(
    [AllowNull()]
    [object]$Request,
    [string]$Name
  )

  if ($null -eq $Request) {
    return $null
  }
  if ($Request -is [System.Collections.IDictionary]) {
    if ($Request.Contains($Name)) {
      return $Request[$Name]
    }
    return $null
  }

  $property = $Request.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }
  return $property.Value
}

function Handle-ApiTest {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [string]$Body
  )

  if ($Body.Length -gt 65536) {
    Send-Json -Stream $Stream -StatusCode 413 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "提交内容过大" -Message "请求内容超过本地服务限制。" -NextStep "刷新页面后重新填写配置。"
    })
    return
  }

  try {
    $request = $Body | ConvertFrom-Json -ErrorAction Stop
  } catch {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "请求内容无效" -Message "页面提交的数据不是有效 JSON。" -NextStep "刷新页面后重新填写配置。"
    })
    return
  }

  $apiUrl = [string](Get-RequestPropertyValue -Request $request -Name "apiUrl")
  $apiKey = [string](Get-RequestPropertyValue -Request $request -Name "apiKey")
  $modelName = [string](Get-RequestPropertyValue -Request $request -Name "modelName")

  if ([string]::IsNullOrWhiteSpace($apiUrl) -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($modelName)) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "配置不完整" -Message "接口地址、API Key 和模型名都必须填写。" -NextStep "补齐三个字段后再测试。" -Code "incomplete_config"
    })
    return
  }

  try {
    $result = Invoke-ProviderConnectionTest -ApiUrl $apiUrl.Trim() -ApiKey $apiKey.Trim() -ModelName $modelName.Trim()
    $responseStatus = Get-ProviderResultHttpStatus -Result $result
    Send-Json -Stream $Stream -StatusCode $responseStatus -Payload $result
    if ($result.ok) {
      Write-ServerLog "API test succeeded (provider status $($result.status), $($result.latencyMs) ms). Key was not logged."
    } else {
      $errorCode = if ($result.error.code) { $result.error.code } else { "none" }
      Write-ServerLog "API test failed (local HTTP $responseStatus, provider status $($result.error.status), code $errorCode). Key was not logged."
    }
  } catch {
    $safeMessage = Protect-ProviderMessage -Message $_.Exception.Message -ApiKey $apiKey
    Send-Json -Stream $Stream -StatusCode 500 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "本地测试服务发生错误" -Message $safeMessage -NextStep "刷新页面再试；如果仍然失败，重新启动本地服务。"
    })
    Write-ServerLog "Local API test handler error. Key was not logged."
  }
}

function Handle-ApiChat {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [string]$Body
  )

  if ($Body.Length -gt 524288) {
    Send-Json -Stream $Stream -StatusCode 413 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "聊天内容过大" -Message "本次提交的内容超过本地服务限制。" -NextStep "缩短最近聊天记录或角色人设后再试。"
    })
    return
  }

  try {
    $request = $Body | ConvertFrom-Json -ErrorAction Stop
  } catch {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "聊天请求格式不正确" -Message "页面提交的数据不是有效 JSON。" -NextStep "刷新页面后再发送一次。"
    })
    return
  }

  $apiUrl = [string](Get-RequestPropertyValue -Request $request -Name "apiUrl")
  $apiKey = [string](Get-RequestPropertyValue -Request $request -Name "apiKey")
  $modelName = [string](Get-RequestPropertyValue -Request $request -Name "modelName")
  $characterName = [string](Get-RequestPropertyValue -Request $request -Name "characterName")
  $persona = [string](Get-RequestPropertyValue -Request $request -Name "persona")
  $requestMessages = Get-RequestPropertyValue -Request $request -Name "messages"
  $incomingMessages = @($requestMessages | Where-Object { $null -ne $_ })

  if ([string]::IsNullOrWhiteSpace($apiUrl) -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($modelName)) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "API 配置不完整" -Message "接口地址、API Key 和模型名都必须存在。" -NextStep "回到设置页完成配置并重新测试连接。" -Code "incomplete_config"
    })
    return
  }

  if ([string]::IsNullOrWhiteSpace($persona)) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "角色人设为空" -Message "聊天请求没有包含角色人设。" -NextStep "打开聊天页右上角的角色编辑，填写人设后保存。"
    })
    return
  }

  if ([string]::IsNullOrWhiteSpace($characterName)) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "角色名字为空" -Message "聊天请求没有包含角色名字。" -NextStep "打开聊天页右上角的角色编辑，填写名字后保存。"
    })
    return
  }

  if ($characterName.Length -gt 24) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "角色名字过长" -Message "角色名字不能超过 24 个字符。" -NextStep "缩短角色名字后保存，再重新发送消息。"
    })
    return
  }

  if ($persona.Length -gt 4000) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "角色人设过长" -Message "人设超过 4000 个字符。" -NextStep "精简角色人设后保存，再重新发送消息。"
    })
    return
  }

  if ($incomingMessages.Count -eq 0 -or $incomingMessages.Count -gt 21) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "聊天记录数量不合适" -Message "一次只能提交当前消息和最近 20 条聊天记录。" -NextStep "刷新页面后重新发送；聊天记录太长时先清空或缩短历史记录。"
    })
    return
  }

  $providerMessages = [System.Collections.Generic.List[object]]::new()
  $providerMessages.Add([ordered]@{
    role = "system"
    content = "角色名字：$($characterName.Trim())`n$($persona.Trim())"
  }) | Out-Null

  $hasUserMessage = $false
  foreach ($message in $incomingMessages) {
    $role = [string]$message.role
    $content = [string]$message.content
    if (
      ($role -ne "user" -and $role -ne "assistant") -or
      [string]::IsNullOrWhiteSpace($content)
    ) {
      continue
    }
    if ($content.Length -gt 16000) {
      Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
        ok = $false
        error = New-ConnectionError -Title "消息内容过长" -Message "单条消息不能超过 16000 个字符。" -NextStep "缩短这条消息后再发送。"
      })
      return
    }
    if ($role -eq "user") {
      $hasUserMessage = $true
    }
    $providerMessages.Add([ordered]@{
      role = $role
      content = $content
    }) | Out-Null
  }

  if (-not $hasUserMessage) {
    Send-Json -Stream $Stream -StatusCode 400 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "没有可发送的用户消息" -Message "聊天请求里没有有效的用户消息。" -NextStep "在输入框里重新输入一条消息后发送。"
    })
    return
  }

  try {
    $result = Invoke-ProviderChatCompletion `
      -ApiUrl $apiUrl.Trim() `
      -ApiKey $apiKey.Trim() `
      -ModelName $modelName.Trim() `
      -Messages $providerMessages.ToArray()
    $responseStatus = Get-ProviderResultHttpStatus -Result $result
    Send-Json -Stream $Stream -StatusCode $responseStatus -Payload $result
    if ($result.ok) {
      Write-ServerLog "API chat succeeded (provider status $($result.status), $($result.latencyMs) ms). Key and messages were not logged."
    } else {
      $errorCode = if ($result.error.code) { $result.error.code } else { "none" }
      Write-ServerLog "API chat failed (local HTTP $responseStatus, provider status $($result.error.status), code $errorCode). Key and messages were not logged."
    }
  } catch {
    $safeMessage = Protect-ProviderMessage -Message $_.Exception.Message -ApiKey $apiKey
    Send-Json -Stream $Stream -StatusCode 500 -Payload ([ordered]@{
      ok = $false
      error = New-ConnectionError -Title "本地聊天服务发生错误" -Message $safeMessage -NextStep "刷新页面再试；如果仍然失败，重新启动本地服务。"
    })
    Write-ServerLog "Local API chat handler error. Key and messages were not logged."
  }
}

if (-not ("PocketLabTcpListener" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Net;
using System.Net.Sockets;

public sealed class PocketLabTcpListener : IDisposable
{
    private readonly TcpListener _listener;
    public PocketLabTcpListener(IPAddress address, int port)
    {
        _listener = new TcpListener(address, port);
    }
    public void Start() { _listener.Start(); }
    public TcpClient AcceptTcpClient() { return _listener.AcceptTcpClient(); }
    public void Stop() { _listener.Stop(); }
    public void Dispose() { _listener.Stop(); }
}
"@
}

$listenerAddress = if ($LocalOnly) {
  [System.Net.IPAddress]::Loopback
} else {
  [System.Net.IPAddress]::Any
}

$listener = $null
$selectedPort = $Port
for ($candidate = $Port; $candidate -lt ($Port + 20); $candidate++) {
  try {
    $listener = [PocketLabTcpListener]::new($listenerAddress, $candidate)
    $listener.Start()
    $selectedPort = $candidate
    break
  } catch {
    if ($null -ne $listener) {
      $listener.Dispose()
      $listener = $null
    }
  }
}

if ($null -eq $listener) {
  throw "无法在 $Port-$($Port + 19) 端口范围内启动本地服务。"
}

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
$serverUrl = "http://127.0.0.1:$selectedPort"
Write-ServerLog "Server started at $serverUrl (local only: $($LocalOnly.IsPresent))"
Write-Host ""
Write-Host "本地 API 服务已启动：$serverUrl" -ForegroundColor Green
Write-Host ""
Write-Host "按 Ctrl+C 停止服务。"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 60000
    $stream = $client.GetStream()

    try {
      $request = Read-HttpRequest -Stream $stream
      if ($null -eq $request) {
        continue
      }

      $targetPath = ($request.Target -split "\?")[0]
      if ($request.Method -eq "GET" -and $targetPath -eq "/api/health") {
        Send-Json -Stream $stream -StatusCode 200 -Payload ([ordered]@{
          ok = $true
          mode = "powershell-api"
          port = $selectedPort
        })
      } elseif ($request.Method -eq "POST" -and $targetPath -eq "/api/test") {
        Handle-ApiTest -Stream $stream -Body $request.Body
      } elseif ($request.Method -eq "POST" -and $targetPath -eq "/api/chat") {
        Handle-ApiChat -Stream $stream -Body $request.Body
      } elseif ($request.Method -eq "POST") {
        Send-Json -Stream $stream -StatusCode 404 -Payload ([ordered]@{ ok = $false; error = "Not found" })
      } elseif ($request.Method -eq "GET") {
        Send-Json -Stream $stream -StatusCode 404 -Payload ([ordered]@{ ok = $false; error = "Not found" })
      } else {
        Send-Response -Stream $stream -StatusCode 405 -ContentType "text/plain; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes("Method not allowed"))
      }
    } catch {
      try {
        Send-Response -Stream $stream -StatusCode 500 -ContentType "text/plain; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes("Internal server error"))
      } catch {
      }
      Write-ServerLog "Request error: $($_.Exception.GetType().Name)"
    } finally {
      $stream.Dispose()
      $client.Dispose()
    }
  }
} finally {
  $listener.Dispose()
  Write-ServerLog "Server stopped"
}
