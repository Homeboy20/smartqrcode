param(
  [string]$HostName = '127.0.0.1',
  [int]$Port = 3000,
  [int]$StartupTimeoutSec = 40
)

$ErrorActionPreference = 'Stop'

function Invoke-Json {
  param(
    [string]$Url,
    [string]$Method = 'GET',
    [hashtable]$Headers = @{},
    [string]$BodyJson = $null,
    [int]$TimeoutSec = 10
  )

  $args = @{ Uri = $Url; Method = $Method; Headers = $Headers; TimeoutSec = $TimeoutSec; UseBasicParsing = $true }
  if ($BodyJson) { $args.ContentType = 'application/json'; $args.Body = $BodyJson }

  try {
    $r = Invoke-WebRequest @args
    $ct = $r.Headers['content-type']
    $obj = $null
    try { $obj = $r.Content | ConvertFrom-Json } catch { $obj = $null }

    return [pscustomobject]@{
      StatusCode = $r.StatusCode
      ContentType = $ct
      Body = $obj
      Raw = $r.Content
    }
  } catch {
    # Windows PowerShell 5.1 throws on non-2xx, but the response is still available.
    $resp = $_.Exception.Response
    if ($resp) {
      try {
        $statusCode = [int]$resp.StatusCode
      } catch {
        $statusCode = 0
      }

      $ct = $null
      try { $ct = $resp.Headers['Content-Type'] } catch { $ct = $null }

      $raw = $null
      try {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
      } catch {
        $raw = $null
      }

      $obj = $null
      try { $obj = $raw | ConvertFrom-Json } catch { $obj = $null }

      return [pscustomobject]@{
        StatusCode = $statusCode
        ContentType = $ct
        Body = $obj
        Raw = $raw
      }
    }

    throw
  }
}

function Wait-ForHealth {
  param([string]$BaseUrl)

  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-Json -Url "$BaseUrl/api/health" -TimeoutSec 3
      if ($resp.StatusCode -eq 200) { return $true }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }
  return $false
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$baseUrl = "http://$HostName`:$Port"

Write-Host "[smoke] Starting production server at $baseUrl" -ForegroundColor Cyan

try { Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}

$env:NODE_ENV = 'production'
$env:HOST = $HostName
$env:PORT = "$Port"

$logDir = Join-Path $projectRoot '.tmp'
try { New-Item -ItemType Directory -Path $logDir -Force | Out-Null } catch {}
$outLog = Join-Path $logDir 'smoke-prod-out.log'
$errLog = Join-Path $logDir 'smoke-prod-err.log'
try { Remove-Item -Force $outLog -ErrorAction SilentlyContinue } catch {}
try { Remove-Item -Force $errLog -ErrorAction SilentlyContinue } catch {}

$proc = Start-Process -FilePath "node" -ArgumentList @("scripts/start.js") -WorkingDirectory $projectRoot -PassThru -NoNewWindow -RedirectStandardOutput $outLog -RedirectStandardError $errLog

try {
  if (-not (Wait-ForHealth -BaseUrl $baseUrl)) {
    Write-Host "[smoke] Server did not become healthy; dumping logs..." -ForegroundColor Red
    if (Test-Path $outLog) {
      Write-Host "[smoke] --- stdout (tail) ---" -ForegroundColor DarkGray
      try { Get-Content -Path $outLog -Tail 80 | ForEach-Object { Write-Host $_ } } catch {}
    }
    if (Test-Path $errLog) {
      Write-Host "[smoke] --- stderr (tail) ---" -ForegroundColor DarkGray
      try { Get-Content -Path $errLog -Tail 80 | ForEach-Object { Write-Host $_ } } catch {}
    }
    throw "Server did not become healthy within ${StartupTimeoutSec}s."
  }

  Write-Host "[smoke] /api/health OK" -ForegroundColor Green

  $countries = @('NG','DE','US')

  foreach ($cc in $countries) {
    $q = Invoke-Json -Url "$baseUrl/api/pricing?country=$cc"
    Write-Host ("[smoke] pricing?country={0} -> {1}" -f $cc, $q.Body.currency.code)
  }

  # create-session override (will likely error if Supabase isn't configured, but must stay JSON)
  $payload = @{ planId = 'pro'; provider = 'flutterwave'; paymentMethod = 'card'; email = 'test@example.com'; countryCode = 'NG'; successUrl = "$baseUrl/success"; cancelUrl = "$baseUrl/cancel"; idempotencyKey = "smoke_${([guid]::NewGuid().ToString())}" } | ConvertTo-Json
  $resp = Invoke-Json -Url "$baseUrl/api/checkout/create-session" -Method 'POST' -BodyJson $payload -TimeoutSec 10
  Write-Host "[smoke] create-session status=$($resp.StatusCode) ct=$($resp.ContentType)" -ForegroundColor Yellow
  if ($resp.Body -and $resp.Body.error) {
    Write-Host "[smoke] create-session error=$($resp.Body.error)" -ForegroundColor Yellow
  } else {
    $snippet = ($resp.Raw | Out-String)
    if ($snippet.Length -gt 300) { $snippet = $snippet.Substring(0, 300) + '…' }
    Write-Host "[smoke] create-session raw=$snippet" -ForegroundColor DarkYellow
  }

  Write-Host "[smoke] Done." -ForegroundColor Green
} finally {
  Write-Host "[smoke] Stopping production server (pid=$($proc.Id))" -ForegroundColor Cyan
  try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  try { Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
  if ((Test-Path $outLog) -or (Test-Path $errLog)) {
    Write-Host "[smoke] Logs: $outLog | $errLog" -ForegroundColor DarkGray
  }
}
