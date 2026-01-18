param(
  [string]$HostName = '127.0.0.1',
  [int]$Port = 3000,
  [int]$StartupTimeoutSec = 20
)

$ErrorActionPreference = 'Stop'

function Invoke-JsonGet {
  param(
    [string]$Url,
    [hashtable]$Headers = @{},
    [int]$TimeoutSec = 10
  )

  $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method GET -Headers $Headers -TimeoutSec $TimeoutSec
  $ct = $r.Headers['content-type']
  $obj = $null
  try { $obj = $r.Content | ConvertFrom-Json } catch { $obj = $null }

  return [pscustomobject]@{
    StatusCode = $r.StatusCode
    ContentType = $ct
    Body = $obj
    Raw = $r.Content
  }
}

function Wait-ForHealth {
  param([string]$BaseUrl)

  $deadline = (Get-Date).AddSeconds($StartupTimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-JsonGet -Url "$BaseUrl/api/health" -TimeoutSec 3
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

# Ensure we don't have a stale node on the port.
try {
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

$env:NODE_ENV = 'production'
$env:HOST = $HostName
$env:PORT = "$Port"

$proc = Start-Process -FilePath "node" -ArgumentList @("scripts/start.js") -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden

try {
  if (-not (Wait-ForHealth -BaseUrl $baseUrl)) {
    throw "Server did not become healthy within ${StartupTimeoutSec}s."
  }

  Write-Host "[smoke] /api/health OK" -ForegroundColor Green

  $testCountries = @(
    'NG','GH','KE','ZA',
    'DE','FR','GB',
    'US','BR'
  )

  foreach ($cc in $testCountries) {
    $resp = Invoke-JsonGet -Url "$baseUrl/api/pricing" -Headers @{ 'x-vercel-ip-country' = $cc }

    $currency = $resp.Body.currency.code
    $providers = ($resp.Body.availableProviders -join ',')
    $recommended = $resp.Body.recommendedProvider

    Write-Host ("[smoke] {0} -> {1} | providers=[{2}] | recommended={3}" -f $cc, $currency, $providers, $recommended)
  }

  Write-Host "[smoke] Done." -ForegroundColor Green
} finally {
  Write-Host "[smoke] Stopping production server (pid=$($proc.Id))" -ForegroundColor Cyan
  try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  try { Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
}
