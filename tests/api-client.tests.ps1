Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $root "lib\api-client.ps1")

$cases = @{
  "https://api.example.com" = "https://api.example.com/v1/chat/completions"
  "https://api.example.com/v1" = "https://api.example.com/v1/chat/completions"
  "https://api.example.com/v1/" = "https://api.example.com/v1/chat/completions"
  "https://api.example.com/v1/chat/completions" = "https://api.example.com/v1/chat/completions"
  "https://api.example.com/v1/chat/completions/" = "https://api.example.com/v1/chat/completions"
  "https://api.example.com//v1//chat/completions" = "https://api.example.com/v1/chat/completions"
  "https://api.example.com/compatible-mode/v1" = "https://api.example.com/compatible-mode/v1/chat/completions"
  "https://api.example.com/chat" = "https://api.example.com/chat/completions"
}

foreach ($entry in $cases.GetEnumerator()) {
  $actual = Resolve-ProviderChatEndpoint -ApiUrl $entry.Key
  if ($actual -ne $entry.Value) {
    throw "Endpoint normalization failed for $($entry.Key): $actual"
  }
}

$key = "placeholder-test-key"
$safe = Protect-ProviderMessage -Message "Rejected $key Bearer abc.def.ghi" -ApiKey $key
if ($safe -match [regex]::Escape($key) -or $safe -match "abc\.def\.ghi") {
  throw "Sensitive value masking failed: $safe"
}

$tlsException = [System.Exception]::new(
  "HTTPS request failed.",
  [System.Net.WebException]::new("The security package has no credentials available. (0x8009030E) $key")
)
$transportError = Get-ProviderTransportError -Exception $tlsException -ApiKey $key
if ($null -eq $transportError -or $transportError.code -ne "windows_tls_credentials") {
  throw "Windows TLS credential error was not classified correctly."
}
if ($transportError.message -match [regex]::Escape($key)) {
  throw "Windows TLS credential error exposed the API key."
}

$tlsError = Get-ProviderTransportError -Exception ([System.Exception]::new("Could not create SSL/TLS secure channel.")) -ApiKey $key
if ($null -eq $tlsError -or $tlsError.code -ne "tls_transport") {
  throw "Generic TLS transport error was not classified correctly."
}

$networkError = Get-ProviderTransportError -Exception ([System.Exception]::new("Connection refused by host.")) -ApiKey $key
if ($null -ne $networkError) {
  throw "Unrelated network error was incorrectly classified as TLS."
}

$nodeRuntime = Get-ProviderNodeRuntime
if ($null -ne $nodeRuntime -and -not (Test-Path -LiteralPath $script:ProviderNodeTransportPath -PathType Leaf)) {
  throw "The Node transport helper is missing."
}

$nodeTimeoutError = Get-ProviderNodeTransportError -Code "timeout" -Message "Request timed out." -ApiKey $key
if ($nodeTimeoutError.code -ne "timeout" -or $nodeTimeoutError.status -ne 0) {
  throw "Node transport timeout was not classified correctly."
}
if ($nodeTimeoutError.message -notmatch "120 秒") {
  throw "Node transport timeout did not report the configured wait time."
}

$timeoutResult = [ordered]@{
  ok = $false
  error = $nodeTimeoutError
}
if ((Get-ProviderResultHttpStatus -Result $timeoutResult) -ne 504) {
  throw "Timeout results must be returned to the browser as HTTP 504."
}

$providerRejectedResult = [ordered]@{
  ok = $false
  error = New-ConnectionError -Title "Rejected" -Message "Rejected" -NextStep "Retry." -Status 451 -Code "model_output_budget"
}
if ((Get-ProviderResultHttpStatus -Result $providerRejectedResult) -ne 451) {
  throw "Provider HTTP errors must retain their status code."
}

$invalidSuccessResult = [ordered]@{
  ok = $false
  error = New-ConnectionError -Title "Invalid response" -Message "Invalid response" -NextStep "Retry." -Status 200 -Code "invalid_response"
}
if ((Get-ProviderResultHttpStatus -Result $invalidSuccessResult) -ne 502) {
  throw "Failed requests must never be returned to the browser as HTTP 200."
}

$nodeSocketError = Get-ProviderNodeTransportError -Code "socket_permission" -Message "EACCES $key" -ApiKey $key
if ($nodeSocketError.code -ne "socket_permission" -or $nodeSocketError.message -match [regex]::Escape($key)) {
  throw "Node socket permission error was not safely classified."
}

$resetAttempts = @(
  [pscustomobject]@{
    attempt = 1
    phase = "connecting"
    rawCode = "ECONNRESET"
    remoteAddress = "203.0.113.10"
    remotePort = 443
  }
  [pscustomobject]@{
    attempt = 2
    phase = "connecting"
    rawCode = "ECONNRESET"
    remoteAddress = "203.0.113.10"
    remotePort = 443
  }
)
$resetNextStep = "Turn off the VPN and retry."
$nodeResetError = Get-ProviderNodeTransportError `
  -Code "connection_reset" `
  -Message "Connection reset before the request reached the provider." `
  -NextStep $resetNextStep `
  -Attempts $resetAttempts `
  -ApiKey $key
if (
  $nodeResetError.code -ne "connection_reset" -or
  $nodeResetError.nextStep -ne $resetNextStep -or
  @($nodeResetError.attempts).Count -ne 2 -or
  $nodeResetError.message -match [regex]::Escape($key)
) {
  throw "Node connection reset diagnostics were not preserved safely."
}

$nodeMissingError = Get-ProviderNodeTransportError -Code "node_missing" -Message "Node missing." -ApiKey $key
if ($nodeMissingError.code -ne "node_missing") {
  throw "Missing Node transport was not classified correctly."
}

$transportSource = [System.IO.File]::ReadAllText(
  $script:ProviderNodeTransportPath,
  [System.Text.Encoding]::UTF8
)
if ($transportSource -match "(?i)curl|schannel|child_process") {
  throw "The Node transport still contains a Windows HTTPS fallback."
}

$requestBody = New-ProviderTestRequestPayload -ModelName "test-model" | ConvertTo-Json -Depth 8 -Compress
if ($requestBody -match '"max(?:_completion)?_tokens"\s*:') {
  throw "The connection test must not force a tiny output token limit."
}

$chatPayload = New-ProviderChatRequestPayload -ModelName "test-model" -Messages @(
  [ordered]@{ role = "system"; content = "角色名字：阿岚`n你是阿岚。" }
  [ordered]@{ role = "user"; content = "你好" }
  [ordered]@{ role = "assistant"; content = "第一行`n`n第二行" }
)
$chatBody = $chatPayload | ConvertTo-Json -Depth 8 -Compress
if ($chatBody -notmatch '"role":"system"' -or $chatBody -notmatch '"role":"assistant"') {
  throw "Chat payload did not preserve the system and assistant messages."
}
if ($chatBody -match '"max(?:_completion)?_tokens"\s*:') {
  throw "Chat payload must not force a tiny output token limit."
}

$replyPayload = [pscustomobject]@{
  choices = @(
    [pscustomobject]@{
      message = [pscustomobject]@{
        content = "第一行`n`n第二行"
      }
    }
  )
}
$replyText = Get-ReplyText -Payload $replyPayload
if ($replyText -ne "第一行`n`n第二行") {
  throw "The complete multiline reply was not preserved."
}

$budgetMessage = 'Protocol generation failed: protocol upstream 400: {"error":{"code":400,"message":"AI Studio returned an empty response: max output tokens were exhausted before any answer (raise max_output_tokens / thinking budget) (finish_reason=max_tokens)","status":"INVALID_ARGUMENT"}}'
if (-not (Test-ProviderOutputBudgetError -Message $budgetMessage)) {
  throw "Output budget exhaustion was not recognized."
}

$budgetError = Get-ProviderHttpError -StatusCode 451 -Body $budgetMessage -ApiKey $key
if ($budgetError.code -ne "model_output_budget" -or $budgetError.status -ne 451) {
  throw "HTTP 451 output budget error was not classified correctly."
}
if ($budgetError.title -match "API Key|权限|接口地址") {
  throw "Output budget error was incorrectly presented as a credential or address error."
}

$unrelated451 = Get-ProviderHttpError -StatusCode 451 -Body '{"error":{"message":"Unavailable for legal reasons."}}' -ApiKey $key
if ($unrelated451.code -eq "model_output_budget") {
  throw "An unrelated HTTP 451 error was incorrectly classified as output budget exhaustion."
}

$notFoundError = Get-ProviderHttpError -StatusCode 404 -Body '{"error":{"message":"Not found"}}' -ApiKey $key
$diagnosticError = Add-ProviderEndpointDiagnostic -ConnectionError $notFoundError -EndpointLabel "/v1/chat/completions"
if (
  $diagnosticError.code -ne "http_404" -or
  $diagnosticError.message -notmatch "/v1/chat/completions" -or
  $diagnosticError.nextStep -notmatch "Base URL"
) {
  throw "HTTP 404 endpoint diagnostics were not preserved."
}

$rejected = $false
try {
  Resolve-ProviderChatEndpoint -ApiUrl "ftp://api.example.com/v1" | Out-Null
} catch {
  $rejected = $true
}
if (-not $rejected) {
  throw "Non-HTTP endpoint should be rejected."
}

Write-Host "API client tests passed."
