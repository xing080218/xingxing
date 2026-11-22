Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$serverScript = Join-Path $root "server.ps1"
$serverProcess = $null
$mockProcess = $null

function Get-FreeTcpPort {
  $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $probe.Start()
  try {
    return ([System.Net.IPEndPoint]$probe.LocalEndpoint).Port
  } finally {
    $probe.Stop()
  }
}

function Wait-ForTcpPort {
  param(
    [int]$Port,
    [int]$TimeoutMilliseconds = 8000
  )

  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  while ($watch.ElapsedMilliseconds -lt $TimeoutMilliseconds) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
      $task = $client.ConnectAsync("127.0.0.1", $Port)
      if ($task.Wait(250) -and $client.Connected) {
        return $true
      }
    } catch {
    } finally {
      $client.Dispose()
    }
    Start-Sleep -Milliseconds 80
  }
  return $false
}

function Invoke-JsonPost {
  param(
    [string]$Url,
    [string]$Json
  )

  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Json)
  $request = [System.Net.HttpWebRequest]::Create($Url)
  $request.Method = "POST"
  $request.ContentType = "application/json; charset=utf-8"
  $request.ContentLength = $bodyBytes.Length
  $request.Timeout = 8000
  $request.ReadWriteTimeout = 8000

  $requestStream = $request.GetRequestStream()
  try {
    $requestStream.Write($bodyBytes, 0, $bodyBytes.Length)
  } finally {
    $requestStream.Dispose()
  }

  $response = $null
  try {
    $response = $request.GetResponse()
  } catch [System.Net.WebException] {
    $response = $_.Exception.Response
  }

  if ($null -eq $response) {
    throw "No HTTP response was received from $Url."
  }

  $statusCode = [int]$response.StatusCode
  $reader = [System.IO.StreamReader]::new(
    $response.GetResponseStream(),
    [System.Text.Encoding]::UTF8
  )
  try {
    $body = $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
    $response.Dispose()
  }

  return [pscustomobject]@{
    StatusCode = $statusCode
    Body = $body
    Json = $body | ConvertFrom-Json -ErrorAction Stop
  }
}

try {
  $port = Get-FreeTcpPort
  $serverProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", "`"$serverScript`"",
      "-Port", [string]$port,
      "-LocalOnly"
    ) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  if (-not (Wait-ForTcpPort -Port $port)) {
    throw "The local API service did not start."
  }

  $baseUrl = "http://127.0.0.1:$port"
  $testResponse = Invoke-JsonPost -Url "$baseUrl/api/test" -Json "{}"
  if (
    $testResponse.StatusCode -ne 400 -or
    $testResponse.Json.ok -ne $false -or
    $testResponse.Json.error.code -ne "incomplete_config" -or
    [string]::IsNullOrWhiteSpace([string]$testResponse.Json.error.nextStep)
  ) {
    throw "Empty test configuration should return HTTP 400 with incomplete_config and a next step. Body: $($testResponse.Body)"
  }

  $chatResponse = Invoke-JsonPost -Url "$baseUrl/api/chat" -Json "{}"
  if (
    $chatResponse.StatusCode -ne 400 -or
    $chatResponse.Json.ok -ne $false -or
    $chatResponse.Json.error.code -ne "incomplete_config" -or
    [string]::IsNullOrWhiteSpace([string]$chatResponse.Json.error.nextStep)
  ) {
    throw "Empty chat configuration should return HTTP 400 with incomplete_config and a next step. Body: $($chatResponse.Body)"
  }

  $mockPort = Get-FreeTcpPort
  $recordPath = Join-Path $root "work\local-world-book-provider-record.json"
  if (Test-Path -LiteralPath $recordPath) {
    Remove-Item -LiteralPath $recordPath -Force
  }
  $mockScript = Join-Path $root "tests\mock-provider.ps1"
  $mockProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", "`"$mockScript`"",
      "-Port", [string]$mockPort,
      "-ListenAddress", "127.0.0.1",
      "-RepeatReplies",
      "-MaxRequests", "1",
      "-RecordPath", "`"$recordPath`""
    ) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  if (-not (Wait-ForTcpPort -Port $mockPort)) {
    throw "The mock provider did not start."
  }

  $worldBookChatJson = [ordered]@{
    apiUrl = "http://127.0.0.1:$mockPort/v1"
    apiKey = "placeholder-local-world-book-key"
    modelName = "test-model"
    characterName = "Test Character"
    persona = "Test persona."
    userProfile = [ordered]@{
      name = "Test User"
      persona = "User profile must enter the system prompt."
    }
    worldBook = [ordered]@{
      name = "Test World Book"
      content = "World Book content must enter the system prompt."
    }
    messages = @(
      [ordered]@{
        role = "user"
        content = "Hello"
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  $worldBookResponse = Invoke-JsonPost `
    -Url "$baseUrl/api/chat" `
    -Json $worldBookChatJson
  if (
    $worldBookResponse.StatusCode -ne 200 -or
    $worldBookResponse.Json.ok -ne $true
  ) {
    throw "World Book chat should succeed through the local service. Body: $($worldBookResponse.Body)"
  }

  $record = Get-Content -LiteralPath $recordPath -Encoding UTF8 -Raw |
    ConvertFrom-Json -ErrorAction Stop
  $systemContent = [string]$record.messages[0].content
  if (
    $systemContent -notmatch "Test User" -or
    $systemContent -notmatch "User profile must enter the system prompt." -or
    $systemContent -notmatch "Test World Book" -or
    $systemContent -notmatch "World Book content must enter the system prompt." -or
    $record.messages[1].content -ne "Hello"
  ) {
    throw "User profile and World Book content were not inserted into the system prompt correctly."
  }
  if ($systemContent -match "API Key") {
    throw "Unexpected content was inserted into the system prompt."
  }

  Write-Host "Local API contract test passed: incomplete settings return HTTP 400 with guidance, and user profile plus World Book content reach the provider through the system prompt."
} finally {
  if ($null -ne $mockProcess -and -not $mockProcess.HasExited) {
    Stop-Process -Id $mockProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $mockProcess) {
    $mockProcess.Dispose()
  }
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $serverProcess) {
    $serverProcess.Dispose()
  }
}
