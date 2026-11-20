Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $root "lib\api-client.ps1")

function ConvertFrom-Utf8Base64 {
  param([string]$Value)
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

$nodeRuntime = Get-ProviderNodeRuntime
if ($null -eq $nodeRuntime) {
  Write-Host "Node transport tests skipped: local Node runtime not found."
  exit 0
}

$transportPath = Join-Path $root "lib\provider-node-transport.js"
$lanAddress = (
  & $nodeRuntime -e "console.log(require(process.argv[1]).getPreferredLocalIPv4())" $transportPath
).Trim()
$listenAddress = if ([string]::IsNullOrWhiteSpace($lanAddress)) {
  "127.0.0.1"
} else {
  "0.0.0.0"
}
$resetFirstRequests = if ([string]::IsNullOrWhiteSpace($lanAddress)) { 1 } else { 2 }
$nativeAttemptCount = if ([string]::IsNullOrWhiteSpace($lanAddress)) { 2 } else { 3 }

$probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$probe.Start()
$port = ([System.Net.IPEndPoint]$probe.LocalEndpoint).Port
$probe.Stop()

$workDirectory = Join-Path $root "work"
New-Item -ItemType Directory -Force -Path $workDirectory | Out-Null
$recordPath = Join-Path $workDirectory "node-transport-test-records.json"
$transportRecordPath = "$recordPath.transports.json"
if (Test-Path -LiteralPath $recordPath) {
  Remove-Item -LiteralPath $recordPath -Force
}
if (Test-Path -LiteralPath $transportRecordPath) {
  Remove-Item -LiteralPath $transportRecordPath -Force
}

$mockPath = Join-Path $root "tests\mock-provider.ps1"
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = "powershell.exe"
$startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$mockPath`" -Port $port -ListenAddress $listenAddress -ChatSequence -ResetFirstRequests $resetFirstRequests -RecordPath `"$recordPath`""
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$mockProcess = [System.Diagnostics.Process]::new()
$mockProcess.StartInfo = $startInfo

function Wait-ForMockProvider {
  param(
    [int]$Port,
    [int]$TimeoutMilliseconds = 5000
  )

  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  while ($watch.ElapsedMilliseconds -lt $TimeoutMilliseconds) {
    $listeners = netstat -ano 2>$null
    $isListening = $listeners -match ":$Port\s+.*LISTENING"
    if ($isListening) {
      return $true
    }
    Start-Sleep -Milliseconds 80
  }
  return $false
}

$apiHost = if ([string]::IsNullOrWhiteSpace($lanAddress)) { "127.0.0.1" } else { $lanAddress }
$apiUrl = "http://${apiHost}:$port"
$apiKey = "placeholder-node-transport-key"
$modelName = "test-model"
$hello = ConvertFrom-Utf8Base64 "5L2g5aW9"
$firstLine = ConvertFrom-Utf8Base64 "56ys5LiA6KGM"
$secondLine = ConvertFrom-Utf8Base64 "56ys5LqM6KGM"
$thirdLine = ConvertFrom-Utf8Base64 "56ys5LiJ6KGM"
$firstExpected = "$firstLine`n`n$secondLine`n$thirdLine"
$secondExpected = ConvertFrom-Utf8Base64 "5pS25Yiw77yM5Yia5omN5L2g6Zeu5LqG44CC"
$secondPrompt = ConvertFrom-Utf8Base64 "5Yia5omN6K+05LqG5LuA5LmI77yf"
$failureMessage = ConvertFrom-Utf8Base64 "6Kem5Y+R5LiA5qyh5aSx6LSl"
$retryExpected = ConvertFrom-Utf8Base64 "6YeN6K+V5oiQ5Yqf44CC"

try {
  if (-not $mockProcess.Start()) {
    throw "Could not start the mock provider."
  }
  if (-not (Wait-ForMockProvider -Port $port)) {
    throw "The mock provider did not start listening."
  }

  $firstMessages = @(
    [ordered]@{ role = "system"; content = "Character persona." }
    [ordered]@{ role = "user"; content = $hello }
  )
  $first = Invoke-ProviderChatCompletion -ApiUrl $apiUrl -ApiKey $apiKey -ModelName $modelName -Messages $firstMessages
  if (-not $first.ok -or $first.reply -ne $firstExpected) {
    throw "The first Node-transported chat request failed."
  }

  $secondMessages = @(
    [ordered]@{ role = "system"; content = "Character persona." }
    [ordered]@{ role = "user"; content = $hello }
    [ordered]@{ role = "assistant"; content = $first.reply }
    [ordered]@{ role = "user"; content = $secondPrompt }
  )
  $second = Invoke-ProviderChatCompletion -ApiUrl $apiUrl -ApiKey $apiKey -ModelName $modelName -Messages $secondMessages
  if (-not $second.ok -or $second.reply -ne $secondExpected) {
    throw "The continuous conversation request failed."
  }

  $thirdMessages = @(
    [ordered]@{ role = "system"; content = "Character persona." }
    [ordered]@{ role = "user"; content = $failureMessage }
  )
  $third = Invoke-ProviderChatCompletion -ApiUrl $apiUrl -ApiKey $apiKey -ModelName $modelName -Messages $thirdMessages
  if ($third.ok -or $third.error.status -ne 500) {
    throw "The expected provider failure was not returned."
  }

  $fourth = Invoke-ProviderChatCompletion -ApiUrl $apiUrl -ApiKey $apiKey -ModelName $modelName -Messages $thirdMessages
  if (-not $fourth.ok -or $fourth.reply -ne $retryExpected) {
    throw "The retry request did not recover."
  }

  $recordsText = [System.IO.File]::ReadAllText($recordPath, [System.Text.Encoding]::UTF8)
  $records = $recordsText | ConvertFrom-Json -ErrorAction Stop
  if (@($records).Count -ne 4) {
    throw "The mock provider did not receive exactly four requests."
  }
  if ($recordsText.Contains($apiKey)) {
    throw "The API key was written to the provider record."
  }

  $transportRecordsText = [System.IO.File]::ReadAllText(
    $transportRecordPath,
    [System.Text.Encoding]::UTF8
  )
  $transportRecords = $transportRecordsText | ConvertFrom-Json -ErrorAction Stop
  $expectedTransportCount = if ([string]::IsNullOrWhiteSpace($lanAddress)) { 5 } else { 6 }
  if (@($transportRecords).Count -ne $expectedTransportCount) {
    throw "The mock provider did not record the expected number of Node transport attempts."
  }
  if (-not $transportRecords[0].reset) {
    throw "The first Node connection was not interrupted as expected."
  }
  if ([string]::IsNullOrWhiteSpace($lanAddress) -and $transportRecords[1].reset) {
    throw "The compatibility retry was incorrectly reset without a LAN fallback."
  }
  if (-not [string]::IsNullOrWhiteSpace($lanAddress) -and -not $transportRecords[1].reset) {
    throw "The compatibility retry was not interrupted before the LAN fallback."
  }
  if ($transportRecords[0].userAgent -ne "PocketLab/1.0") {
    throw "The first request did not use the normal transport headers."
  }
  if (
    $transportRecords[1].connection -ne "close" -or
    $transportRecords[1].acceptEncoding -ne "identity" -or
    $transportRecords[1].userAgent -notmatch "compatibility retry"
  ) {
    throw "The compatibility retry did not use connection-close headers."
  }
  if ([string]::IsNullOrWhiteSpace($lanAddress)) {
    if ($transportRecords[1].reset) {
      throw "The compatibility retry was incorrectly reset without a LAN fallback."
    }
    if ($transportRecords[2].reset -or -not $transportRecords[2].authorizationPresent) {
      throw "The request after the compatibility retry did not reach the provider with authentication."
    }
    if ($transportRecords[2].userAgent -ne "PocketLab/1.0") {
      throw "The request after the compatibility retry did not use the normal Node transport."
    }
  } else {
    if (
      $transportRecords[2].reset -or
      -not $transportRecords[2].authorizationPresent -or
      $transportRecords[2].remoteAddress -ne $lanAddress
    ) {
      throw "The LAN fallback did not recover through the physical network interface."
    }
    if ($transportRecords[2].userAgent -notmatch "compatibility retry") {
      throw "The LAN fallback did not retain the compatibility transport headers."
    }
    if ($transportRecords[3].reset -or $transportRecords[3].userAgent -ne "PocketLab/1.0") {
      throw "The request after LAN recovery did not return to the normal Node transport."
    }
  }
  if ($transportRecordsText -match "Schannel|curl") {
    throw "The recovery transport attempted to use the Windows Schannel bridge."
  }
  if ($transportRecordsText.Contains($apiKey)) {
    throw "The API key was written to the recovery transport record."
  }

  $fetchProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $fetchProbe.Start()
  $fetchPort = ([System.Net.IPEndPoint]$fetchProbe.LocalEndpoint).Port
  $fetchProbe.Stop()
  $fetchRecordPath = Join-Path $workDirectory "node-fetch-fallback-records.json"
  $fetchTransportRecordPath = "$fetchRecordPath.transports.json"
  foreach ($pathToReset in @($fetchRecordPath, $fetchTransportRecordPath)) {
    if (Test-Path -LiteralPath $pathToReset) {
      Remove-Item -LiteralPath $pathToReset -Force
    }
  }

  $fetchStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $fetchStartInfo.FileName = "powershell.exe"
  $fetchStartInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$mockPath`" -Port $fetchPort -ListenAddress $listenAddress -ResetFirstRequests $nativeAttemptCount -RecordPath `"$fetchRecordPath`""
  $fetchStartInfo.UseShellExecute = $false
  $fetchStartInfo.CreateNoWindow = $true
  $fetchMockProcess = [System.Diagnostics.Process]::new()
  $fetchMockProcess.StartInfo = $fetchStartInfo

  try {
    if (-not $fetchMockProcess.Start()) {
      throw "Could not start the fetch fallback mock provider."
    }
    if (-not (Wait-ForMockProvider -Port $fetchPort)) {
      throw "The fetch fallback mock provider did not start listening."
    }

    $fetchApiUrl = "http://${apiHost}:$fetchPort"
    $fetchFallback = Invoke-ProviderConnectionTest `
      -ApiUrl $fetchApiUrl `
      -ApiKey $apiKey `
      -ModelName $modelName
    if (-not $fetchFallback.ok -or $fetchFallback.reply -ne "OK") {
      throw "The Node Fetch compatibility fallback did not recover after native connection resets."
    }

    $fetchTransportRecordsText = [System.IO.File]::ReadAllText(
      $fetchTransportRecordPath,
      [System.Text.Encoding]::UTF8
    )
    $fetchTransportRecords = $fetchTransportRecordsText | ConvertFrom-Json -ErrorAction Stop
    if (@($fetchTransportRecords).Count -ne ($nativeAttemptCount + 1)) {
      throw "The fetch fallback mock provider did not record every connection attempt."
    }
    $fetchRequest = $fetchTransportRecords[$nativeAttemptCount]
    if (
      $fetchRequest.reset -or
      -not $fetchRequest.authorizationPresent -or
      $fetchRequest.userAgent -notmatch "Chrome/.*compatibility retry"
    ) {
      throw "The fallback request did not reach the provider with compatibility headers and authentication."
    }
    if ($fetchTransportRecordsText.Contains($apiKey)) {
      throw "The API key was written to the fetch fallback transport record."
    }
  } finally {
    if (-not $fetchMockProcess.HasExited) {
      try {
        $fetchMockProcess.Kill()
      } catch {
      }
    }
    $fetchMockProcess.Dispose()
  }

  Write-Host "Node transport tests passed."
} finally {
  if (-not $mockProcess.HasExited) {
    try {
      $mockProcess.Kill()
    } catch {
    }
  }
  $mockProcess.Dispose()
}
