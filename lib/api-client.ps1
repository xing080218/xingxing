Set-StrictMode -Version Latest

$script:DefaultTimeoutSeconds = 120
$script:ProviderNodeRuntime = $null
$script:ProviderNodeTransportPath = Join-Path $PSScriptRoot "provider-node-transport.js"

function Get-ProviderNodeRuntime {
  if (-not [string]::IsNullOrWhiteSpace($script:ProviderNodeRuntime)) {
    if (Test-Path -LiteralPath $script:ProviderNodeRuntime -PathType Leaf) {
      return $script:ProviderNodeRuntime
    }
    $script:ProviderNodeRuntime = $null
  }

  $candidates = [System.Collections.Generic.List[string]]::new()
  if (-not [string]::IsNullOrWhiteSpace($env:POCKETLAB_NODE_PATH)) {
    $candidates.Add($env:POCKETLAB_NODE_PATH)
  }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($null -ne $nodeCommand -and -not [string]::IsNullOrWhiteSpace($nodeCommand.Source)) {
    $candidates.Add($nodeCommand.Source)
  }

  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $candidates.Add((Join-Path $env:ProgramFiles "nodejs\node.exe"))
  }
  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"))
  }

  $bundledRoot = if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
    $null
  } else {
    Join-Path $env:USERPROFILE ".workbuddy\binaries\node\versions"
  }
  if ($null -ne $bundledRoot -and (Test-Path -LiteralPath $bundledRoot -PathType Container)) {
    $bundledVersions = Get-ChildItem -LiteralPath $bundledRoot -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending
    foreach ($version in $bundledVersions) {
      $candidates.Add((Join-Path $version.FullName "node.exe"))
    }
  }

  foreach ($candidate in $candidates) {
    if (
      -not [string]::IsNullOrWhiteSpace($candidate) -and
      (Test-Path -LiteralPath $candidate -PathType Leaf)
    ) {
      $script:ProviderNodeRuntime = [System.IO.Path]::GetFullPath($candidate)
      return $script:ProviderNodeRuntime
    }
  }

  return $null
}

function Get-ProviderNodeTransportError {
  param(
    [AllowNull()]
    [string]$Code,
    [AllowNull()]
    [string]$Message,
    [AllowNull()]
    [string]$NextStep = "",
    [AllowNull()]
    [object[]]$Attempts = $null,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey
  )

  $safeMessage = Protect-ProviderMessage -Message $Message -ApiKey $ApiKey
  $normalizedCode = if ([string]::IsNullOrWhiteSpace($Code)) { "network" } else { $Code }

  switch ($normalizedCode) {
    "timeout" {
      return New-ConnectionError `
        -Title "连接超时" `
        -Message "本地服务已经响应，但接口地址在 $($script:DefaultTimeoutSeconds) 秒内没有返回完整响应。" `
        -NextStep "失败发生在电脑到模型服务商这一段，不是手机 Wi-Fi 问题。先用电脑浏览器打开服务商控制台，确认网络可以访问；再退出 VPN、代理或安全软件的网络拦截。如果当前使用推理模型，请换用普通对话模型后重试。" `
        -Code "timeout"
    }
    "dns" {
      return New-ConnectionError -Title "找不到接口服务器" -Message $safeMessage -NextStep "检查接口地址中的域名是否复制正确，并确认当前网络能打开服务商官网。" -Code "dns"
    }
    "connection_refused" {
      return New-ConnectionError -Title "接口服务器拒绝连接" -Message $safeMessage -NextStep "确认接口地址、端口和协议与服务商文档一致；服务商维护期间也可能暂时拒绝连接。" -Code "connection_refused"
    }
    "certificate" {
      return New-ConnectionError -Title "接口证书验证失败" -Message $safeMessage -NextStep "先用浏览器打开接口域名，确认证书有效且没有公司网络或安全软件的证书拦截。若服务商使用自签名证书，请按其文档处理。" -Code "certificate"
    }
    "socket_permission" {
      return New-ConnectionError -Title "本机网络权限阻止了连接" -Message $safeMessage -NextStep "请求尚未到达服务商。请重新双击 start.bat，并在 Windows 防火墙或安全软件中允许 PowerShell 与 Node.js 访问网络；如开启了 VPN 或代理，也请检查其规则。这不是 API Key 错误。" -Code "socket_permission"
    }
    "connection_reset" {
      $resolvedNextStep = if ([string]::IsNullOrWhiteSpace($NextStep)) {
        "检查 VPN、代理或公司网络是否中断了连接，然后重新测试。"
      } else {
        $NextStep
      }
      $connectionError = New-ConnectionError `
        -Title "电脑无法连接模型服务商" `
        -Message $safeMessage `
        -NextStep $resolvedNextStep `
        -Code "connection_reset"
      if ($null -ne $Attempts -and @($Attempts).Count -gt 0) {
        $connectionError.attempts = @($Attempts)
      }
      return $connectionError
    }
    "response_too_large" {
      return New-ConnectionError -Title "服务商返回内容过大" -Message $safeMessage -NextStep "确认接口地址指向 chat/completions，而不是文件或其他大体积接口。" -Code "response_too_large"
    }
    "redirect" {
      return New-ConnectionError -Title "接口跳转地址无效" -Message $safeMessage -NextStep "从服务商文档重新复制完整接口地址，避免使用会跳转到错误页面的网址。" -Code "redirect"
    }
    "invalid_url" {
      return New-ConnectionError -Title "接口地址格式不正确" -Message $safeMessage -NextStep "检查地址是否以 http:// 或 https:// 开头。" -Code "invalid_url"
    }
    "request_too_large" {
      return New-ConnectionError -Title "本次提交内容过大" -Message $safeMessage -NextStep "缩短角色人设或最近聊天记录后再试。" -Code "request_too_large"
    }
    "transport_internal" {
      return New-ConnectionError -Title "本机连接组件没有完成请求" -Message $safeMessage -NextStep "关闭本地服务并重新双击 start.bat；若仍失败，请把这条错误反馈给我。" -Code "transport_internal"
    }
    "node_missing" {
      return New-ConnectionError -Title "本机连接组件未启动" -Message "没有找到可用的 Node 连接组件，因此本次请求没有发往服务商。" -NextStep "关闭本地服务并重新双击 start.bat；如果仍出现，请确认项目文件夹中的 lib\provider-node-transport.js 没有被删除。" -Code "node_missing"
    }
    default {
      return New-ConnectionError -Title "无法访问接口地址" -Message $safeMessage -NextStep "检查接口地址是否完整、服务商官网能否正常打开，以及 VPN、代理或安全软件是否拦截连接。" -Code $normalizedCode
    }
  }
}

function Invoke-ProviderNodeTransport {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Endpoint,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,
    [Parameter(Mandatory = $true)]
    [string]$Body
  )

  $nodeRuntime = Get-ProviderNodeRuntime
  if ($null -eq $nodeRuntime) {
    return $null
  }

  if (-not (Test-Path -LiteralPath $script:ProviderNodeTransportPath -PathType Leaf)) {
    return [ordered]@{
      ok = $false
      transportError = [ordered]@{
        code = "transport_internal"
        message = "本机连接组件文件不存在。"
      }
    }
  }

  $inputPayload = [ordered]@{
    url = $Endpoint
    method = "POST"
    timeoutMs = ($script:DefaultTimeoutSeconds * 1000)
    headers = [ordered]@{
      Authorization = "Bearer $ApiKey"
    }
    body = $Body
  } | ConvertTo-Json -Depth 6 -Compress

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $nodeRuntime
  $startInfo.Arguments = '"' + $script:ProviderNodeTransportPath.Replace('"', '\"') + '"'
  $startInfo.WorkingDirectory = Split-Path -Parent $script:ProviderNodeTransportPath
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $startInfo.StandardErrorEncoding = [System.Text.Encoding]::UTF8
  $startInfo.EnvironmentVariables["NODE_NO_WARNINGS"] = "1"

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo

  try {
    if (-not $process.Start()) {
      throw "无法启动本机连接组件。"
    }

    $inputBytes = [System.Text.Encoding]::UTF8.GetBytes($inputPayload)
    $process.StandardInput.BaseStream.Write($inputBytes, 0, $inputBytes.Length)
    $process.StandardInput.BaseStream.Close()

    $outputTask = $process.StandardOutput.ReadToEndAsync()
    $errorTask = $process.StandardError.ReadToEndAsync()
    $waitMilliseconds = [int](($script:DefaultTimeoutSeconds + 8) * 1000)
    if (-not $process.WaitForExit($waitMilliseconds)) {
      try {
        $process.Kill()
      } catch {
      }
      return [ordered]@{
        ok = $false
        transportError = [ordered]@{
          code = "timeout"
          message = "本机连接组件没有在规定时间内完成请求。"
        }
      }
    }

    $output = $outputTask.GetAwaiter().GetResult()
    $null = $errorTask.GetAwaiter().GetResult()
    if ([string]::IsNullOrWhiteSpace($output)) {
      return [ordered]@{
        ok = $false
        transportError = [ordered]@{
          code = "transport_internal"
          message = "本机连接组件没有返回结果。"
        }
      }
    }

    try {
      return $output | ConvertFrom-Json -ErrorAction Stop
    } catch {
      return [ordered]@{
        ok = $false
        transportError = [ordered]@{
          code = "transport_internal"
          message = "本机连接组件返回了无法识别的内容。"
        }
      }
    }
  } catch {
    return [ordered]@{
      ok = $false
      transportError = [ordered]@{
        code = "transport_internal"
        message = "本机连接组件启动失败。"
      }
    }
  } finally {
    $process.Dispose()
  }
}

function Resolve-ProviderChatEndpoint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
  )

  $trimmed = $ApiUrl.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    throw "接口地址不能为空。"
  }

  $uri = $null
  if (-not [System.Uri]::TryCreate($trimmed, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "接口地址格式不正确，应以 http:// 或 https:// 开头。"
  }

  if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") {
    throw "接口地址只支持 http:// 或 https://。"
  }

  $path = $uri.AbsolutePath.TrimEnd("/")
  $path = $path -replace "/{2,}", "/"
  if ([string]::IsNullOrEmpty($path)) {
    $path = "/v1/chat/completions"
  } elseif ($path -notmatch "/chat/completions$") {
    if ($path -match "/v1$" -or $path -match "/compatible-mode/v1$" -or $path -match "/api/v1$") {
      $path = "$path/chat/completions"
    } elseif ($path -match "/chat$") {
      $path = "$path/completions"
    } else {
      $path = "$path/chat/completions"
    }
  }

  $builder = [System.UriBuilder]::new($uri)
  $builder.Path = $path
  $builder.Fragment = ""
  return $builder.Uri.AbsoluteUri
}

function Add-ProviderEndpointDiagnostic {
  param(
    [Parameter(Mandatory = $true)]
    $ConnectionError,
    [Parameter(Mandatory = $true)]
    [string]$EndpointLabel
  )

  if ([int]$ConnectionError.status -eq 404) {
    $ConnectionError.message = "$($ConnectionError.message)`n实际请求路径：$EndpointLabel"
    $ConnectionError.nextStep = "接口地址请只填服务商文档中的 Base URL（常见以 /v1 结尾），或完整填入以 /chat/completions 结尾的地址，二选一，不要填写网页登录地址。模型名必须填写文档中的模型 ID；如果两项都确认无误，请把服务商文档里的请求示例发给我。"
  }

  return $ConnectionError
}

function Get-ProviderEndpointLabel {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
  )

  $resolved = Resolve-ProviderChatEndpoint -ApiUrl $ApiUrl
  $uri = [System.Uri]::new($resolved)
  return $uri.AbsolutePath
}

function New-ConnectionError {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [Parameter(Mandatory = $true)]
    [string]$NextStep,
    [int]$Status = 0,
    [string]$Code = ""
  )

  return [ordered]@{
    title = $Title
    message = $Message
    nextStep = $NextStep
    status = $Status
    code = $Code
  }
}

function Get-ProviderResultHttpStatus {
  param(
    [AllowNull()]
    $Result
  )

  if ($null -eq $Result) {
    return 502
  }

  $isDictionary = $Result -is [System.Collections.IDictionary]
  if ($isDictionary) {
    if ($Result.Contains("ok") -and [bool]$Result["ok"]) {
      return 200
    }
    $errorValue = if ($Result.Contains("error")) { $Result["error"] } else { $null }
  } else {
    $okProperty = $Result.PSObject.Properties["ok"]
    if ($null -ne $okProperty -and [bool]$okProperty.Value) {
      return 200
    }
    $errorProperty = $Result.PSObject.Properties["error"]
    $errorValue = if ($null -ne $errorProperty) { $errorProperty.Value } else { $null }
  }

  $providerStatus = 0
  $code = ""

  if ($null -ne $errorValue) {
    if ($errorValue -is [System.Collections.IDictionary]) {
      if ($errorValue.Contains("status")) {
        [void][int]::TryParse([string]$errorValue["status"], [ref]$providerStatus)
      }
      if ($errorValue.Contains("code")) {
        $code = [string]$errorValue["code"]
      }
    } else {
      $statusProperty = $errorValue.PSObject.Properties["status"]
      if ($null -ne $statusProperty) {
        [void][int]::TryParse([string]$statusProperty.Value, [ref]$providerStatus)
      }
      $codeProperty = $errorValue.PSObject.Properties["code"]
      if ($null -ne $codeProperty) {
        $code = [string]$codeProperty.Value
      }
    }
  }

  if ($providerStatus -ge 400 -and $providerStatus -le 599) {
    return $providerStatus
  }

  if ($code -eq "timeout" -or $code -eq "api_proxy_timeout") {
    return 504
  }

  return 502
}

function Protect-ProviderMessage {
  param(
    [AllowNull()]
    [string]$Message,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey
  )

  if ([string]::IsNullOrWhiteSpace($Message)) {
    return ""
  }

  $safe = $Message.Trim()
  if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
    $safe = $safe.Replace($ApiKey, "[已隐藏]")
  }

  $safe = $safe -replace "(?i)bearer\s+[A-Za-z0-9._\-]+", "Bearer [已隐藏]"
  $safe = $safe -replace "(?i)(sk-[A-Za-z0-9_\-]{6,})", "[已隐藏]"

  if ($safe.Length -gt 520) {
    $safe = $safe.Substring(0, 520) + "..."
  }

  return $safe
}

function Get-ExceptionText {
  param(
    [AllowNull()]
    [System.Exception]$Exception
  )

  if ($null -eq $Exception) {
    return ""
  }

  $messages = [System.Collections.Generic.List[string]]::new()
  $current = $Exception
  while ($null -ne $current) {
    if (
      -not [string]::IsNullOrWhiteSpace($current.Message) -and
      -not $messages.Contains($current.Message.Trim())
    ) {
      $messages.Add($current.Message.Trim())
    }
    $current = $current.InnerException
  }

  return ($messages -join " -> ")
}

function Test-WindowsTlsCredentialError {
  param(
    [AllowNull()]
    [string]$Message
  )

  if ([string]::IsNullOrWhiteSpace($Message)) {
    return $false
  }

  return $Message -match "(?i)安全包中没有可用的凭证|security package has no credentials?|no credentials are available in the security package|SEC_E_NO_CREDENTIALS|0x8009030e"
}

function Test-TlsTransportError {
  param(
    [AllowNull()]
    [string]$Message
  )

  if ([string]::IsNullOrWhiteSpace($Message)) {
    return $false
  }

  return $Message -match "(?i)\bSSL\b|\bTLS\b|secure channel|安全通道|Schannel|SEC_E_|0x800903|authentication failed"
}

function Get-ProviderTransportError {
  param(
    [Parameter(Mandatory = $true)]
    [System.Exception]$Exception,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey
  )

  $details = Protect-ProviderMessage -Message (Get-ExceptionText -Exception $Exception) -ApiKey $ApiKey

  if (Test-WindowsTlsCredentialError -Message $details) {
    return [ordered]@{
      code = "windows_tls_credentials"
      title = "正在运行旧版连接组件"
      message = "当前请求仍调用了 Windows HTTPS 安全组件，并返回了旧版组件错误（0x8009030E）。"
      nextStep = "关闭所有旧的启动窗口，再到项目文件夹双击 start.bat，等新服务启动后刷新页面并重新测试。新版本只使用 Node/OpenSSL，不再调用 Windows Schannel。这不是 API Key、模型名或接口地址内容错误。"
    }
  }

  if (Test-TlsTransportError -Message $details) {
    return [ordered]@{
      code = "tls_transport"
      title = "本机无法建立 HTTPS 连接"
      message = "与接口地址建立加密连接时失败。系统原文：$details"
      nextStep = "先用浏览器打开服务商官网，确认当前网络能正常访问；再检查 VPN、代理、公司网络或安全软件是否拦截 HTTPS。若服务商使用自签名证书，请按其文档处理证书。这不是 API Key 错误。"
    }
  }

  return $null
}

function Get-ProviderErrorMessage {
  param(
    [AllowNull()]
    [string]$Body
  )

  if ([string]::IsNullOrWhiteSpace($Body)) {
    return ""
  }

  try {
    $json = $Body | ConvertFrom-Json -ErrorAction Stop
    if ($null -ne $json.error) {
      if ($json.error -is [string]) {
        return $json.error
      }
      if ($null -ne $json.error.message) {
        return [string]$json.error.message
      }
    }
    if ($null -ne $json.message) {
      return [string]$json.message
    }
  } catch {
    return $Body
  }

  return $Body
}

function Test-ProviderOutputBudgetError {
  param(
    [AllowNull()]
    [string]$Message
  )

  if ([string]::IsNullOrWhiteSpace($Message)) {
    return $false
  }

  $hasBudgetName = $Message -match "(?i)max(?:imum)?\s+output\s+tokens?|max_output_tokens|max_completion_tokens|max_tokens|thinking\s+budget"
  $hasExhaustionSignal = $Message -match "(?i)exhaust(?:ed|ion)?|ran\s+out|used\s+up|not\s+enough|empty\s+response|before\s+any\s+answer|no\s+answer|no\s+output|finish_reason\s*=\s*max_tokens|\braise\b|\bincrease\b|\bhigher\b"

  return $hasBudgetName -and $hasExhaustionSignal
}

function Get-ProviderHttpError {
  param(
    [Parameter(Mandatory = $true)]
    [int]$StatusCode,
    [AllowNull()]
    [string]$Body,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey
  )

  $providerMessage = Protect-ProviderMessage -Message (Get-ProviderErrorMessage -Body $Body) -ApiKey $ApiKey
  $displayMessage = if ([string]::IsNullOrWhiteSpace($providerMessage)) {
    "服务商没有提供详细错误信息。"
  } else {
    $providerMessage
  }

  if (Test-ProviderOutputBudgetError -Message $displayMessage) {
    return New-ConnectionError -Status $StatusCode -Title "模型输出预算不足" -Message "服务商已经收到请求，但模型的思考过程在生成答复前耗尽了输出预算。服务商原文：$displayMessage" -NextStep "这不是 API Key、接口地址或权限错误。请在服务商控制台或网关中提高 max_output_tokens / thinking budget；如果当前模型是推理模型，也可以先换用普通对话模型再测试。" -Code "model_output_budget"
  }

  $error = switch ($StatusCode) {
    400 {
      New-ConnectionError -Status $StatusCode -Title "请求参数被服务商拒绝" -Message $displayMessage -NextStep "重点检查模型名是否与服务商文档完全一致，并确认该模型支持 chat/completions 接口。"
    }
    401 {
      New-ConnectionError -Status $StatusCode -Title "API Key 未通过验证" -Message $displayMessage -NextStep "重新复制完整 API Key，确认没有空格或引号；再到服务商控制台确认 Key 已启用且账户状态正常。"
    }
    403 {
      New-ConnectionError -Status $StatusCode -Title "当前 Key 没有调用权限" -Message $displayMessage -NextStep "检查该 Key 是否开通了对应模型，或服务商是否要求额外权限、IP 白名单或项目 ID。"
    }
    404 {
      New-ConnectionError -Status $StatusCode -Title "接口地址或模型不存在" -Message $displayMessage -NextStep "对照服务商文档检查 Base URL；模型名请填写文档里的模型 ID，不要填写页面上的显示名称。" -Code "http_404"
    }
    429 {
      New-ConnectionError -Status $StatusCode -Title "请求过多或额度不足" -Message $displayMessage -NextStep "检查账户余额和限流设置，等待几分钟后再测试。"
    }
    default {
      if ($StatusCode -ge 500) {
        New-ConnectionError -Status $StatusCode -Title "服务商暂时不可用" -Message $displayMessage -NextStep "这不是你填写错误造成的。稍后再试，并查看服务商状态页是否发布故障通知。"
      } else {
        New-ConnectionError -Status $StatusCode -Title "服务商拒绝了请求" -Message $displayMessage -NextStep "检查接口地址、API Key 和模型名是否来自同一家服务商和同一个项目。"
      }
    }
  }

  return $error
}

function Get-ReplyText {
  param(
    [AllowNull()]
    $Payload
  )

  if ($null -eq $Payload) {
    return ""
  }

  $choicesProperty = $Payload.PSObject.Properties["choices"]
  if ($null -ne $choicesProperty) {
    $choices = @($choicesProperty.Value)
    if ($choices.Count -gt 0) {
      $messageProperty = $choices[0].PSObject.Properties["message"]
      if ($null -ne $messageProperty) {
        $message = $messageProperty.Value
        if ($null -eq $message) {
          return ""
        }
        $contentProperty = $message.PSObject.Properties["content"]
        if ($null -ne $contentProperty -and $null -ne $contentProperty.Value) {
          $content = $contentProperty.Value
          if ($content -is [string]) {
            return $content.Trim()
          }
          if ($content -is [System.Array]) {
            $parts = foreach ($part in $content) {
              $partTextProperty = $part.PSObject.Properties["text"]
              if ($null -ne $partTextProperty -and $partTextProperty.Value) {
                [string]$partTextProperty.Value
              }
            }
            return (($parts | Where-Object { $_ }) -join " ").Trim()
          }
        }
      }
    }
  }

  $outputTextProperty = $Payload.PSObject.Properties["output_text"]
  if ($null -ne $outputTextProperty -and $null -ne $outputTextProperty.Value) {
    return [string]$outputTextProperty.Value
  }

  return ""
}

function New-ProviderTestRequestPayload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ModelName
  )

  return New-ProviderChatRequestPayload -ModelName $ModelName -Messages @(
    [ordered]@{
      role = "user"
      content = "只回复 OK"
    }
  )
}

function New-ProviderChatRequestPayload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ModelName,
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [object[]]$Messages
  )

  $normalizedMessages = @()
  foreach ($message in $Messages) {
    if ($null -eq $message) {
      continue
    }
    $role = [string]$message.role
    $content = [string]$message.content
    if (
      ($role -eq "system" -or $role -eq "user" -or $role -eq "assistant") -and
      -not [string]::IsNullOrWhiteSpace($content)
    ) {
      $normalizedMessages += [ordered]@{
        role = $role
        content = $content
      }
    }
  }

  return [ordered]@{
    model = $ModelName
    messages = $normalizedMessages
    stream = $false
  }
}

function Invoke-ProviderChatRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Endpoint,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,
    [Parameter(Mandatory = $true)]
    [string]$ModelName,
    [AllowNull()]
    [object[]]$Messages = $null
  )

  $bodyObject = if ($null -eq $Messages) {
    New-ProviderTestRequestPayload -ModelName $ModelName
  } else {
    New-ProviderChatRequestPayload -ModelName $ModelName -Messages $Messages
  }
  $body = $bodyObject | ConvertTo-Json -Depth 8 -Compress

  $nodeResult = Invoke-ProviderNodeTransport -Endpoint $Endpoint -ApiKey $ApiKey -Body $body
  if ($null -ne $nodeResult) {
    if (-not $nodeResult.ok) {
      $transportError = $nodeResult.transportError
      $transportNextStep = ""
      $transportAttempts = $null
      if ($null -ne $transportError.PSObject.Properties["nextStep"]) {
        $transportNextStep = [string]$transportError.nextStep
      }
      if ($null -ne $transportError.PSObject.Properties["attempts"]) {
        $transportAttempts = @($transportError.attempts)
      }
      return [ordered]@{
        TransportError = Get-ProviderNodeTransportError `
          -Code ([string]$transportError.code) `
          -Message ([string]$transportError.message) `
          -NextStep $transportNextStep `
          -Attempts $transportAttempts `
          -ApiKey $ApiKey
      }
    }

    return [ordered]@{
      StatusCode = [int]$nodeResult.statusCode
      Body = [string]$nodeResult.body
      Success = ([int]$nodeResult.statusCode -ge 200 -and [int]$nodeResult.statusCode -lt 300)
      TransportError = $null
    }
  }

  return [ordered]@{
    TransportError = Get-ProviderNodeTransportError `
      -Code "node_missing" `
      -Message "本机连接组件未启动。" `
      -ApiKey $ApiKey
  }
}

function Invoke-ProviderChatCompletion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,
    [Parameter(Mandatory = $true)]
    [string]$ModelName,
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [object[]]$Messages
  )

  $startedAt = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $endpoint = Resolve-ProviderChatEndpoint -ApiUrl $ApiUrl
    $endpointLabel = Get-ProviderEndpointLabel -ApiUrl $ApiUrl
  } catch {
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Title "接口地址格式不正确" -Message $_.Exception.Message -NextStep "检查地址是否以 https:// 开头，再从服务商文档复制一次。"
    }
  }

  try {
    $result = Invoke-ProviderChatRequest -Endpoint $endpoint -ApiKey $ApiKey -ModelName $ModelName -Messages $Messages
  } catch {
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Title "请求没有完成" -Message (Protect-ProviderMessage -Message (Get-ExceptionText -Exception $_.Exception) -ApiKey $ApiKey) -NextStep "检查本机网络权限、VPN 或代理后，点击消息下方的重试按钮。请求失败时，你发送的消息仍保留在本机。" -Code "request_incomplete"
    }
  }

  $startedAt.Stop()
  $latencyMs = [int]$startedAt.ElapsedMilliseconds

  if ($null -ne $result.TransportError) {
    return [ordered]@{
      ok = $false
      error = $result.TransportError
    }
  }

  if (-not $result.Success) {
    $httpError = Get-ProviderHttpError -StatusCode ([int]$result.StatusCode) -Body $result.Body -ApiKey $ApiKey
    return [ordered]@{
      ok = $false
      error = Add-ProviderEndpointDiagnostic -ConnectionError $httpError -EndpointLabel $endpointLabel
    }
  }

  try {
    $payload = $result.Body | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Status $result.StatusCode -Title "返回格式不符合预期" -Message "服务商返回了成功状态，但内容不是标准 JSON。请确认接口地址指向 chat/completions，而不是网页或控制台页面。" -NextStep "从服务商文档重新复制 OpenAI 兼容接口地址；如果文档使用其他协议，请提供文档做专用适配。" -Code "invalid_response"
    }
  }

  $reply = Get-ReplyText -Payload $payload
  if ([string]::IsNullOrWhiteSpace($reply)) {
    if (Test-ProviderOutputBudgetError -Message $result.Body) {
      return [ordered]@{
        ok = $false
        error = Get-ProviderHttpError -StatusCode 0 -Body $result.Body -ApiKey $ApiKey
      }
    }
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Status $result.StatusCode -Title "模型没有返回文字" -Message "服务商返回了有效 JSON，但 choices[0].message.content 为空。" -NextStep "确认模型支持 chat/completions，或换用普通对话模型后点击重试按钮。" -Code "empty_reply"
    }
  }

  $modelProperty = $payload.PSObject.Properties["model"]
  $responseModel = if (
    $null -ne $modelProperty -and
    -not [string]::IsNullOrWhiteSpace([string]$modelProperty.Value)
  ) {
    [string]$modelProperty.Value
  } else {
    $ModelName
  }

  return [ordered]@{
    ok = $true
    status = [int]$result.StatusCode
    model = $responseModel
    latencyMs = $latencyMs
    endpoint = $endpointLabel
    reply = Protect-ProviderMessage -Message $reply -ApiKey $ApiKey
  }
}

function Invoke-ProviderConnectionTest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,
    [Parameter(Mandatory = $true)]
    [string]$ModelName
  )

  $startedAt = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $endpoint = Resolve-ProviderChatEndpoint -ApiUrl $ApiUrl
    $endpointLabel = Get-ProviderEndpointLabel -ApiUrl $ApiUrl
  } catch {
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Title "接口地址格式不正确" -Message $_.Exception.Message -NextStep "检查地址是否以 https:// 开头，再从服务商文档复制一次。"
    }
  }

  try {
    $result = Invoke-ProviderChatRequest -Endpoint $endpoint -ApiKey $ApiKey -ModelName $ModelName
  } catch {
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Title "请求没有完成" -Message (Protect-ProviderMessage -Message (Get-ExceptionText -Exception $_.Exception) -ApiKey $ApiKey) -NextStep "检查本机网络权限、VPN 或代理，然后重新测试。请求尚未确认成功。" -Code "request_incomplete"
    }
  }

  $startedAt.Stop()
  $latencyMs = [int]$startedAt.ElapsedMilliseconds

  if ($null -ne $result.TransportError) {
    return [ordered]@{
      ok = $false
      error = $result.TransportError
    }
  }

  if (-not $result.Success) {
    $httpError = Get-ProviderHttpError -StatusCode ([int]$result.StatusCode) -Body $result.Body -ApiKey $ApiKey
    return [ordered]@{
      ok = $false
      error = Add-ProviderEndpointDiagnostic -ConnectionError $httpError -EndpointLabel $endpointLabel
    }
  }

  try {
    $payload = $result.Body | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return [ordered]@{
      ok = $false
      error = New-ConnectionError -Status $result.StatusCode -Title "返回格式不符合预期" -Message "服务商返回了成功状态，但内容不是标准 JSON。请确认接口地址指向 chat/completions，而不是网页或控制台页面。" -NextStep "从服务商文档重新复制 OpenAI 兼容接口地址；如果文档使用其他协议，请把文档发给我做专用适配。"
    }
  }

  $reply = Get-ReplyText -Payload $payload
  if ([string]::IsNullOrWhiteSpace($reply)) {
    if (Test-ProviderOutputBudgetError -Message $result.Body) {
      return [ordered]@{
        ok = $false
        error = Get-ProviderHttpError -StatusCode 0 -Body $result.Body -ApiKey $ApiKey
      }
    }
    $reply = "服务商返回了有效 JSON，但测试回复为空。"
  }

  $modelProperty = $payload.PSObject.Properties["model"]
  $responseModel = if (
    $null -ne $modelProperty -and
    -not [string]::IsNullOrWhiteSpace([string]$modelProperty.Value)
  ) {
    [string]$modelProperty.Value
  } else {
    $ModelName
  }

  return [ordered]@{
    ok = $true
    status = [int]$result.StatusCode
    model = $responseModel
    latencyMs = $latencyMs
    endpoint = $endpointLabel
    reply = Protect-ProviderMessage -Message $reply -ApiKey $ApiKey
  }
}
