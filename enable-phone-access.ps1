param(
  [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$webPort = 4176
$phoneUrlsPath = Join-Path $root "work\phone-urls.txt"
$inboundRuleName = "Virtual Phone LAN 4176"
$blockedRuleNames = @(
  "codex_sandbox_offline_block_inbound",
  "codex_sandbox_offline_block_outbound"
)
$repairFailed = $false

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
}

function Test-FirewallRuleEnabled {
  param([string]$RuleName)

  $output = @(
    & netsh advfirewall firewall show rule name="$RuleName" 2>&1
  ) -join [Environment]::NewLine
  return $output -match "(?m)^\s*(Enabled|已启用):\s*(Yes|是)\s*$"
}

function Test-WebEntryListening {
  $pattern = "^\s*TCP\s+\S+:$webPort\s+\S+\s+LISTENING\s+\d+\s*$"
  foreach ($line in @(netstat -ano -p tcp 2>$null)) {
    if ([string]$line -match $pattern) {
      return $true
    }
  }
  return $false
}

function Get-PhoneUrls {
  if (Test-Path -LiteralPath $phoneUrlsPath -PathType Leaf) {
    $savedUrls = @(
      Get-Content -LiteralPath $phoneUrlsPath -Encoding UTF8 -ErrorAction SilentlyContinue |
        ForEach-Object { ([string]$_).Trim() } |
        Where-Object { $_ -match "^http://" }
    )
    if ($savedUrls.Count -gt 0) {
      return $savedUrls
    }
  }

  $ipconfigText = @(ipconfig 2>$null) -join [Environment]::NewLine
  $matches = [regex]::Matches(
    $ipconfigText,
    "\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})\b"
  )
  $addresses = [System.Collections.Generic.List[string]]::new()
  foreach ($match in $matches) {
    $address = $match.Value
    if (-not $addresses.Contains($address)) {
      $addresses.Add($address) | Out-Null
    }
  }

  return @($addresses | ForEach-Object { "http://${_}:$webPort" })
}

function Show-Pause {
  if ($NoPause) {
    return
  }

  Write-Host ""
  Read-Host "按 Enter 关闭这个窗口" | Out-Null
}

try {
  if (-not (Test-IsAdministrator)) {
    throw "这个修复需要管理员权限。请双击 enable-phone-access.bat，并在 Windows 提示中选择是（Yes）。"
  }

  foreach ($ruleName in $blockedRuleNames) {
    & netsh advfirewall firewall show rule name="$ruleName" *> $null
    if ($LASTEXITCODE -ne 0) {
      continue
    }

    & netsh advfirewall firewall set rule name="$ruleName" new enable=no *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "无法关闭 Windows 网络拦截规则：$ruleName"
    }
  }

  & netsh advfirewall firewall delete rule name="$inboundRuleName" *> $null
  & netsh advfirewall firewall add rule `
    name="$inboundRuleName" `
    dir=in `
    action=allow `
    protocol=TCP `
    localport=$webPort `
    remoteip=localsubnet `
    profile=any `
    enable=yes *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "无法创建手机局域网访问规则。"
  }

  if (Test-FirewallRuleEnabled -RuleName "codex_sandbox_offline_block_outbound") {
    throw "Windows 的出站拦截仍然处于开启状态。请关闭安全软件或组织策略中的网络限制后重试。"
  }
  if (-not (Test-FirewallRuleEnabled -RuleName $inboundRuleName)) {
    throw "局域网访问规则没有成功启用。"
  }

  $phoneUrls = @(Get-PhoneUrls)

  Write-Host ""
  Write-Host "手机和模型接口所需的 Windows 网络权限已修复。" -ForegroundColor Green
  Write-Host "已解除本机出站拦截，并允许同一局域网访问 TCP $webPort。" -ForegroundColor DarkGray

  if (-not (Test-WebEntryListening)) {
    Write-Host ""
    Write-Host "网页服务当前没有运行。请双击 start.bat，再打开下面显示的地址。" -ForegroundColor Yellow
  }

  if ($phoneUrls.Count -gt 0) {
    Write-Host ""
    Write-Host "手机先打开检查页：" -ForegroundColor White
    Write-Host "  $($phoneUrls[0].TrimEnd('/'))/mobile-check.html" -ForegroundColor Cyan
    Write-Host "再从检查页进入小手机：" -ForegroundColor White
    Write-Host "  $($phoneUrls[0].TrimEnd('/'))/" -ForegroundColor Cyan
  } else {
    Write-Host ""
    Write-Host "没有读到电脑的局域网地址。请先双击 start.bat，再运行一次本修复。" -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "手机必须连接同一个 Wi-Fi，不能是访客网络；VPN 和路由器 AP 隔离也需要关闭。" -ForegroundColor DarkGray
} catch {
  Write-Host ""
  Write-Host "网络权限修复失败。" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "如果 Windows 弹出了管理员确认，请选择是（Yes）；如果仍然失败，请把本窗口内容反馈给我。" -ForegroundColor Yellow
  $repairFailed = $true
} finally {
  Show-Pause
}

if ($repairFailed) {
  exit 1
}
