Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$workDirectory = Join-Path $root "work"
New-Item -ItemType Directory -Force -Path $workDirectory | Out-Null

function Get-FreeTcpPort {
  $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $probe.Start()
  $port = ([System.Net.IPEndPoint]$probe.LocalEndpoint).Port
  $probe.Stop()
  return $port
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

function Stop-TestProcess {
  param([System.Diagnostics.Process]$Process)

  if ($null -eq $Process) {
    return
  }
  if (-not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
  $Process.Dispose()
}

$mockPort = Get-FreeTcpPort
do {
  $apiPort = Get-FreeTcpPort
} while ($apiPort -eq $mockPort)
$mockScript = Join-Path $root "tests\mock-provider.ps1"
$apiScript = Join-Path $root "server.ps1"
$mockProcess = $null
$apiProcess = $null

try {
  $mockProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", "`"$mockScript`"",
      "-Port", [string]$mockPort,
      "-ListenAddress", "127.0.0.1",
      "-DelayMilliseconds", "5000"
    ) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  if (-not (Wait-ForTcpPort -Port $mockPort)) {
    throw "The delayed mock provider did not start."
  }

  $apiProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", "`"$apiScript`"",
      "-Port", [string]$apiPort,
      "-LocalOnly",
      "-ProviderTimeoutSeconds", "1"
    ) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  if (-not (Wait-ForTcpPort -Port $apiPort)) {
    throw "The local API service did not start."
  }

  $payload = [ordered]@{
    apiUrl = "http://127.0.0.1:$mockPort/v1"
    apiKey = "placeholder-timeout-test-key"
    modelName = "test-model"
  } | ConvertTo-Json -Compress
  $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$apiPort/api/test")
  $request.Method = "POST"
  $request.ContentType = "application/json; charset=utf-8"
  $request.ContentLength = $payloadBytes.Length
  $request.Timeout = 15000
  $request.ReadWriteTimeout = 15000

  $requestStream = $request.GetRequestStream()
  try {
    $requestStream.Write($payloadBytes, 0, $payloadBytes.Length)
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
    throw "The timeout test did not receive an HTTP response."
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

  $result = $body | ConvertFrom-Json -ErrorAction Stop
  if ($statusCode -ne 504) {
    throw "Expected timeout HTTP 504, received HTTP $statusCode. Body: $body"
  }
  if ($result.ok -or $result.error.code -ne "timeout") {
    throw "The timeout response did not contain error.code=timeout."
  }

  Write-Host "Provider timeout test passed: HTTP 504 with error.code=timeout."
} finally {
  Stop-TestProcess -Process $apiProcess
  Stop-TestProcess -Process $mockProcess
}
