param(
  [switch]$NoOpen,
  [int]$WebPort = 4176,
  [int]$ApiPort = 4177
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$workDirectory = Join-Path $root "work"
$apiScript = Join-Path $root "server.ps1"
$webScript = Join-Path $root "server.js"
$serverUrlPath = Join-Path $workDirectory "server-url.txt"
$phoneUrlsPath = Join-Path $workDirectory "phone-urls.txt"
$webPidPath = Join-Path $workDirectory "web.pid"
$apiPidPath = Join-Path $workDirectory "api.pid"
$legacyPidPath = Join-Path $workDirectory "server.pid"
$webOutPath = Join-Path $workDirectory "web.console.out.log"
$webErrPath = Join-Path $workDirectory "web.console.err.log"
$apiOutPath = Join-Path $workDirectory "api.console.out.log"
$apiErrPath = Join-Path $workDirectory "api.console.err.log"

New-Item -ItemType Directory -Force -Path $workDirectory | Out-Null

function Read-PidFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return 0
  }

  $raw = (Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue).Trim()
  $value = 0
  if ([int]::TryParse($raw, [ref]$value) -and $value -gt 0) {
    return $value
  }
  return 0
}

function Stop-ManagedProcess {
  param(
    [string]$PidPath
  )

  $processId = Read-PidFile -Path $PidPath
  if ($processId -le 0) {
    Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    return
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -ne $process) {
    $allowedNames = @("node", "powershell", "pwsh")
    $pidFileTime = (Get-Item -LiteralPath $PidPath -ErrorAction SilentlyContinue).LastWriteTime
    $looksReused = (
      $null -ne $pidFileTime -and
      $process.StartTime -gt $pidFileTime.AddMinutes(1)
    )
    if ($allowedNames -contains $process.ProcessName -and -not $looksReused) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      try {
        Wait-Process -Id $processId -Timeout 5 -ErrorAction SilentlyContinue
      } catch {
      }
    }
  }

  Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
}

function Get-PortOwnerIds {
  param([int]$Port)

  $ids = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($line in @(netstat -ano -p tcp 2>$null)) {
    $text = [string]$line
    if ($text -notmatch "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
      continue
    }
    $ownerId = 0
    if ([int]::TryParse($Matches[1], [ref]$ownerId) -and $ownerId -gt 0) {
      [void]$ids.Add($ownerId)
    }
  }
  return @($ids)
}

function Find-NodeRuntime {
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

  if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
    $bundledRoot = Join-Path $env:USERPROFILE ".workbuddy\binaries\node\versions"
    if (Test-Path -LiteralPath $bundledRoot -PathType Container) {
      foreach ($version in @(Get-ChildItem -LiteralPath $bundledRoot -Directory |
        Sort-Object Name -Descending)) {
        $candidates.Add((Join-Path $version.FullName "node.exe"))
      }
    }
  }

  foreach ($candidate in $candidates) {
    if (
      -not [string]::IsNullOrWhiteSpace($candidate) -and
      (Test-Path -LiteralPath $candidate -PathType Leaf)
    ) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }

  return $null
}

function Test-FirewallRuleEnabled {
  param([string]$RuleName)

  $output = @(
    & netsh advfirewall firewall show rule name="$RuleName" 2>&1
  ) -join [Environment]::NewLine
  return $output -match "(?m)^\s*(Enabled|已启用):\s*(Yes|是)\s*$"
}

function Reset-LogFile {
  param([string]$Path)

  Set-Content -LiteralPath $Path -Value "" -Encoding UTF8
}

function Wait-ForServiceReady {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$Port,
    [int]$TimeoutSeconds
  )

  $healthUrl = "http://127.0.0.1:$Port/api/health"
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($Process.HasExited) {
      return $false
    }

    try {
      $response = Invoke-WebRequest `
        -UseBasicParsing `
        -Uri $healthUrl `
        -TimeoutSec 1 `
        -ErrorAction Stop
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
    }

    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Read-ConnectionUrls {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return @()
  }

  return @(
    Get-Content -LiteralPath $Path -Encoding UTF8 -ErrorAction SilentlyContinue |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      ForEach-Object { ([string]$_).Trim() }
  )
}

function Stop-StartedProcess {
  param([System.Diagnostics.Process]$Process)

  if ($null -eq $Process) {
    return
  }
  if (-not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

foreach ($requiredPath in @($apiScript, $webScript, (Join-Path $root "index.html"))) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    Write-Host "Required project file is missing: $requiredPath" -ForegroundColor Red
    exit 1
  }
}

$nodeRuntime = Find-NodeRuntime
if ([string]::IsNullOrWhiteSpace($nodeRuntime)) {
  Write-Host "Node.js was not found. The project cannot start the web entry." -ForegroundColor Red
  exit 1
}

# A new start always replaces the managed processes. This prevents an older
# synchronous server from being reused after the page or API code changes.
Stop-ManagedProcess -PidPath $webPidPath
Stop-ManagedProcess -PidPath $apiPidPath
Stop-ManagedProcess -PidPath $legacyPidPath
Start-Sleep -Milliseconds 400

foreach ($port in @($WebPort, $ApiPort)) {
  $portOwners = @(Get-PortOwnerIds -Port $port)
  if ($portOwners.Count -gt 0) {
    Write-Host "Port $port is already used by process: $($portOwners -join ', ')" -ForegroundColor Red
    Write-Host "Close that old service or choose another port." -ForegroundColor Yellow
    exit 1
  }
}

Remove-Item -LiteralPath $serverUrlPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $phoneUrlsPath -Force -ErrorAction SilentlyContinue
Reset-LogFile -Path $webOutPath
Reset-LogFile -Path $webErrPath
Reset-LogFile -Path $apiOutPath
Reset-LogFile -Path $apiErrPath

$apiProcess = $null
$webProcess = $null

try {
  $apiArguments = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "`"$apiScript`"",
    "-Port",
    [string]$ApiPort,
    "-LocalOnly"
  )
  $apiProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $apiArguments `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $apiOutPath `
    -RedirectStandardError $apiErrPath `
    -PassThru
  Set-Content -LiteralPath $apiPidPath -Value ([string]$apiProcess.Id) -Encoding ASCII

  if (-not (Wait-ForServiceReady -Process $apiProcess -Port $ApiPort -TimeoutSeconds 12)) {
    throw "The local API service did not become ready within 12 seconds."
  }

  $webArguments = @(
    "`"$webScript`"",
    "--port",
    [string]$WebPort,
    "--api-port",
    [string]$ApiPort
  )
  $webProcess = Start-Process `
    -FilePath $nodeRuntime `
    -ArgumentList $webArguments `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $webOutPath `
    -RedirectStandardError $webErrPath `
    -PassThru
  Set-Content -LiteralPath $webPidPath -Value ([string]$webProcess.Id) -Encoding ASCII

  if (-not (Wait-ForServiceReady -Process $webProcess -Port $WebPort -TimeoutSeconds 15)) {
    throw "The web entry did not become ready within 15 seconds."
  }

  $serverUrl = "http://127.0.0.1:$WebPort/"
  $phoneUrls = @(Read-ConnectionUrls -Path $phoneUrlsPath)

  Write-Host ""
  Write-Host "小手机已经在后台启动。" -ForegroundColor Green
  Write-Host "电脑打开：$serverUrl" -ForegroundColor Cyan
  if ($phoneUrls.Count -gt 0) {
    foreach ($phoneUrl in $phoneUrls) {
      Write-Host "手机打开：$($phoneUrl.TrimEnd('/'))/" -ForegroundColor Cyan
    }
    Write-Host "手机检查：$($phoneUrls[0].TrimEnd('/'))/mobile-check.html" -ForegroundColor DarkCyan
  } else {
    Write-Host "手机地址：没有检测到可用的 Wi-Fi 局域网地址。" -ForegroundColor Yellow
  }

  if (Test-FirewallRuleEnabled -RuleName "codex_sandbox_offline_block_outbound") {
    Write-Host ""
    Write-Host "警告：Windows 仍在阻止程序访问模型服务商，连接测试会超时。" -ForegroundColor Yellow
    Write-Host "请双击 enable-phone-access.bat，并在管理员提示中选择是（Yes）。" -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "手机和电脑必须连接同一个 Wi-Fi。" -ForegroundColor DarkGray
  Write-Host "手机打不开时，双击 enable-phone-access.bat 一次。" -ForegroundColor DarkGray

  if (-not $NoOpen) {
    try {
      Start-Process -FilePath $serverUrl -ErrorAction Stop
    } catch {
      Write-Host "Open this address manually: $serverUrl" -ForegroundColor Yellow
    }
  }

  Start-Sleep -Seconds 2
} catch {
  Write-Host ""
  Write-Host "PocketLab could not start." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if (Test-Path -LiteralPath $webErrPath) {
    $webError = (Get-Content -LiteralPath $webErrPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()
    if ($webError) {
      Write-Host "Web error: $webError" -ForegroundColor DarkYellow
    }
  }
  if (Test-Path -LiteralPath $apiErrPath) {
    $apiError = (Get-Content -LiteralPath $apiErrPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()
    if ($apiError) {
      Write-Host "API error: $apiError" -ForegroundColor DarkYellow
    }
  }
  Stop-StartedProcess -Process $webProcess
  Stop-StartedProcess -Process $apiProcess
  Remove-Item -LiteralPath $webPidPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $apiPidPath -Force -ErrorAction SilentlyContinue
  exit 1
}
