param(
  [int]$Port = 4188,
  [string]$ListenAddress = "127.0.0.1",
  [switch]$ForceBudgetError,
  [switch]$ChatSequence,
  [switch]$PunctuationReply,
  [int]$ResetFirstRequests = 0,
  [int]$MaxConnections = 0,
  [int]$DelayMilliseconds = 0,
  [string]$RecordPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-HttpRequest {
  param([System.Net.Sockets.NetworkStream]$Stream)

  $headerBytes = [System.Collections.Generic.List[byte]]::new()
  $lastFour = [byte[]](0, 0, 0, 0)

  while ($true) {
    $nextByte = New-Object byte[] 1
    $read = $Stream.Read($nextByte, 0, 1)
    if ($read -le 0) {
      return $null
    }

    $headerBytes.Add($nextByte[0])
    for ($i = 0; $i -lt 3; $i++) {
      $lastFour[$i] = $lastFour[$i + 1]
    }
    $lastFour[3] = $nextByte[0]

    if (
      $lastFour[0] -eq 13 -and
      $lastFour[1] -eq 10 -and
      $lastFour[2] -eq 13 -and
      $lastFour[3] -eq 10
    ) {
      break
    }
    if ($headerBytes.Count -gt 1048576) {
      throw "Mock provider request headers are too large."
    }
  }

  $headerText = [System.Text.Encoding]::ASCII.GetString($headerBytes.ToArray())
  $lines = $headerText -split "`r`n"
  $requestLine = $lines[0] -split " "
  if ($requestLine.Count -lt 3) {
    throw "Mock provider received an invalid request line."
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

  $bodyBytes = New-Object byte[] $contentLength
  $readTotal = 0
  while ($readTotal -lt $contentLength) {
    $read = $Stream.Read($bodyBytes, $readTotal, $contentLength - $readTotal)
    if ($read -le 0) {
      break
    }
    $readTotal += $read
  }

  return [pscustomobject]@{
    Method = $requestLine[0].ToUpperInvariant()
    Target = $requestLine[1]
    Headers = $headers
    Body = [System.Text.Encoding]::UTF8.GetString($bodyBytes, 0, $readTotal)
  }
}

function Write-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [string]$Body
  )

  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $header = "HTTP/1.1 $StatusCode $Reason`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($bodyBytes, 0, $bodyBytes.Length)
  $Stream.Flush()
}

function New-ReplyJson {
  param([string]$Content)

  return [ordered]@{
    id = "chatcmpl-test"
    model = "test-model"
    choices = @(
      [ordered]@{
        index = 0
        message = [ordered]@{
          role = "assistant"
          content = $Content
        }
        finish_reason = "stop"
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress
}

function Add-SanitizedRecord {
  param(
    [int]$RequestNumber,
    $BodyObject
  )

  if ([string]::IsNullOrWhiteSpace($RecordPath)) {
    return
  }

  $records = @()
  if ([System.IO.File]::Exists($RecordPath)) {
    $existing = [System.IO.File]::ReadAllText($RecordPath, [System.Text.Encoding]::UTF8)
    if (-not [string]::IsNullOrWhiteSpace($existing)) {
      try {
        $existingRecords = ConvertFrom-Json -InputObject $existing -ErrorAction Stop
        foreach ($record in $existingRecords) {
          $records += $record
        }
      } catch {
        $records = @()
      }
    }
  }

  $records += [ordered]@{
    requestNumber = $RequestNumber
    model = [string]$BodyObject.model
    messages = @($BodyObject.messages | ForEach-Object {
      [ordered]@{
        role = [string]$_.role
        content = [string]$_.content
      }
    })
  }
  [System.IO.File]::WriteAllText(
    $RecordPath,
    ($records | ConvertTo-Json -Depth 10),
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Add-TransportRecord {
  param(
    [int]$ConnectionNumber,
    [int]$LogicalRequestNumber,
    [bool]$WasReset,
    [string]$RemoteAddress,
    [hashtable]$Headers
  )

  if ([string]::IsNullOrWhiteSpace($RecordPath)) {
    return
  }

  $transportRecordPath = "$RecordPath.transports.json"
  $records = @()
  if ([System.IO.File]::Exists($transportRecordPath)) {
    $existing = [System.IO.File]::ReadAllText($transportRecordPath, [System.Text.Encoding]::UTF8)
    if (-not [string]::IsNullOrWhiteSpace($existing)) {
      try {
        $existingRecords = ConvertFrom-Json -InputObject $existing -ErrorAction Stop
        foreach ($record in $existingRecords) {
          $records += $record
        }
      } catch {
        $records = @()
      }
    }
  }

  $records += [ordered]@{
    connectionNumber = $ConnectionNumber
    logicalRequestNumber = $LogicalRequestNumber
    reset = $WasReset
    remoteAddress = $RemoteAddress
    connection = if ($Headers.ContainsKey("connection")) { [string]$Headers["connection"] } else { "" }
    acceptEncoding = if ($Headers.ContainsKey("accept-encoding")) { [string]$Headers["accept-encoding"] } else { "" }
    userAgent = if ($Headers.ContainsKey("user-agent")) { [string]$Headers["user-agent"] } else { "" }
    authorizationPresent = $Headers.ContainsKey("authorization")
  }
  [System.IO.File]::WriteAllText(
    $transportRecordPath,
    ($records | ConvertTo-Json -Depth 10),
    [System.Text.UTF8Encoding]::new($false)
  )
}

$listenerAddress = [System.Net.IPAddress]::Parse($ListenAddress)
$listener = [System.Net.Sockets.TcpListener]::new($listenerAddress, $Port)
$listener.Start()

try {
  $requestNumber = 0
  $connectionNumber = 0
  while ($true) {
    if ($MaxConnections -gt 0 -and $connectionNumber -ge $MaxConnections) {
      break
    }
    if (-not $ChatSequence -and $requestNumber -ge 1) {
      break
    }
    if ($ChatSequence -and $requestNumber -ge 8) {
      break
    }

    $client = $listener.AcceptTcpClient()
    $connectionNumber++
    $stream = $client.GetStream()

    try {
      $request = Read-HttpRequest -Stream $stream
      if ($null -eq $request) {
        continue
      }

      if ($connectionNumber -le $ResetFirstRequests) {
        $remoteAddress = $client.Client.RemoteEndPoint.Address.IPAddressToString
        Add-TransportRecord `
          -ConnectionNumber $connectionNumber `
          -LogicalRequestNumber $requestNumber `
          -WasReset $true `
          -RemoteAddress $remoteAddress `
          -Headers $request.Headers
        $client.Client.LingerState = [System.Net.Sockets.LingerOption]::new($true, 0)
        $client.Client.Close()
        continue
      }

      $requestNumber++
      $remoteAddress = $client.Client.RemoteEndPoint.Address.IPAddressToString
      Add-TransportRecord `
        -ConnectionNumber $connectionNumber `
        -LogicalRequestNumber $requestNumber `
        -WasReset $false `
        -RemoteAddress $remoteAddress `
        -Headers $request.Headers

      $bodyObject = $null
      $parseError = $false
      try {
        $bodyObject = $request.Body | ConvertFrom-Json -ErrorAction Stop
      } catch {
        $parseError = $true
      }

      $hasAuth =
        $request.Headers.ContainsKey("authorization") -and
        $request.Headers["authorization"].StartsWith("Bearer ")
      $hasModel =
        $null -ne $bodyObject -and
        [string]$bodyObject.model -eq "test-model"
      $hasTinyTokenLimit = $request.Body -match '"(?:max_tokens|max_completion_tokens)"\s*:\s*16\b'

      if ($ForceBudgetError -or $hasTinyTokenLimit) {
        $json = '{"error":{"code":400,"message":"AI Studio returned an empty response: max output tokens were exhausted before any answer (raise max_output_tokens / thinking budget) (finish_reason=max_tokens)","status":"INVALID_ARGUMENT"}}'
        Write-HttpResponse -Stream $stream -StatusCode 451 -Reason "Unavailable For Legal Reasons" -Body $json
        continue
      }

      if ($parseError -or -not $hasAuth -or -not $hasModel) {
        $json = '{"error":{"message":"Mock provider rejected the request."}}'
        Write-HttpResponse -Stream $stream -StatusCode 401 -Reason "Unauthorized" -Body $json
        continue
      }

      Add-SanitizedRecord -RequestNumber $requestNumber -BodyObject $bodyObject

      if ($DelayMilliseconds -gt 0) {
        Start-Sleep -Milliseconds $DelayMilliseconds
      }

      if ($ChatSequence) {
        $messages = @($bodyObject.messages)
        $firstReply = if ($PunctuationReply) {
          "今天先别急着赶路。要不要坐下来歇一会儿？晚饭想吃什么？"
        } else {
          "第一行`n`n第二行`n第三行"
        }
        if ($requestNumber -eq 2) {
          $expectedHistoryFragment = if ($PunctuationReply) {
            "今天先别急着赶路"
          } else {
            "第一行"
          }
          $hasPreviousTurn =
            $messages.Count -ge 4 -and
            [string]$messages[1].content -match "你好" -and
            [string]$messages[2].content -match $expectedHistoryFragment
          if (-not $hasPreviousTurn) {
            $json = '{"error":{"message":"Mock provider did not receive the previous turn."}}'
            Write-HttpResponse -Stream $stream -StatusCode 400 -Reason "Bad Request" -Body $json
            continue
          }
        }

        switch ($requestNumber) {
          1 {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content $firstReply)
          }
          2 {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "收到，刚才你问了。")
          }
          3 {
            $json = '{"error":{"message":"模拟服务商暂时失败，请重试。"}}'
            Write-HttpResponse -Stream $stream -StatusCode 500 -Reason "Internal Server Error" -Body $json
          }
          4 {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "重试成功。")
          }
          5 {
            $json = '{"error":{"message":"模拟总结回复请求失败，请重试。"}}'
            Write-HttpResponse -Stream $stream -StatusCode 500 -Reason "Internal Server Error" -Body $json
          }
          6 {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "今天的天气很适合散步。`n晚饭可以吃清淡一点。")
          }
          7 {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "重新想过以后，我更想陪你慢慢走一走。`n晚饭就选你此刻最想吃的。")
          }
          8 {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "这次我会把两件事一起考虑。`n散步和晚饭都按你的心情来安排。")
          }
          default {
            Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "OK")
          }
        }
      } else {
        Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body (New-ReplyJson -Content "OK")
      }
    } finally {
      if ($null -ne $stream) {
        $stream.Dispose()
      }
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
