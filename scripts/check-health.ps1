Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$uri = 'http://127.0.0.1:3000/api/health'

try {
  $r = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 10
  'STATUS=' + $r.StatusCode
  'CT=' + $r.Headers['Content-Type']
  $r.Content
} catch {
  $_.Exception.Message
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message }
}
