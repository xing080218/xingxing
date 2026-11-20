Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$serverScript = Join-Path $root "server.ps1"
$serverProcess = $null

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

  Write-Host "Local API contract test passed: incomplete settings return HTTP 400 with guidance."
} finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $serverProcess) {
    $serverProcess.Dispose()
  }
}
