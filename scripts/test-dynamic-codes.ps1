#!/usr/bin/env pwsh

# Dynamic QR Code Functionality Test Script
# This script tests the complete dynamic codes flow

$ErrorActionPreference = "Continue"
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Dynamic QR Code Functionality Test" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "[1/6] Checking if Next.js server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Server is running on http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Server is NOT running. Please start it with: npm run dev" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""

# Check for environment variables
Write-Host "[2/6] Checking environment variables..." -ForegroundColor Yellow
$envFile = ".env.local"
if (Test-Path $envFile) {
    Write-Host "  ✓ .env.local file found" -ForegroundColor Green
    
    $envContent = Get-Content $envFile
    $requiredVars = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -match "^$var=.+") {
            Write-Host "  ✓ $var is set" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $var is missing or empty" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ✗ .env.local file not found" -ForegroundColor Red
}

Write-Host ""

# Check database migration file exists
Write-Host "[3/6] Checking database migration files..." -ForegroundColor Yellow
$migrationFile = "supabase_migrations\13_CREATE_QRCODES_TABLE.sql"
if (Test-Path $migrationFile) {
    Write-Host "  ✓ QRCodes table migration file exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ Migration file not found: $migrationFile" -ForegroundColor Red
}

$scanEventsFile = "supabase_migrations\03_CREATE_QRCODE_SCAN_EVENTS.sql"
if (Test-Path $scanEventsFile) {
    Write-Host "  ✓ Scan events table migration file exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Scan events migration not found (optional): $scanEventsFile" -ForegroundColor Yellow
}

Write-Host ""

# Check API routes exist
Write-Host "[4/6] Checking API routes..." -ForegroundColor Yellow
$apiRoutes = @(
    "src\app\api\codes\route.ts",
    "src\app\api\codes\recent\route.ts",
    "src\app\api\codes\[id]\analytics\route.ts",
    "src\app\c\[id]\route.ts"
)

foreach ($route in $apiRoutes) {
    if (Test-Path $route) {
        Write-Host "  ✓ $route exists" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $route missing" -ForegroundColor Red
    }
}

Write-Host ""

# Check QR code component includes dynamic functionality
Write-Host "[5/6] Checking QR generator component..." -ForegroundColor Yellow
$generatorFile = "src\components\QRCodeGenerator.tsx"
if (Test-Path $generatorFile) {
    $content = Get-Content $generatorFile -Raw
    if ($content -match "useDynamicLink" -and $content -match "/api/codes") {
        Write-Host "  ✓ Dynamic code functionality found in QRCodeGenerator" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Dynamic code logic may be missing in QRCodeGenerator" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ QRCodeGenerator.tsx not found" -ForegroundColor Red
}

Write-Host ""

# Test API endpoint (without auth - just check it exists)
Write-Host "[6/6] Testing API endpoints..." -ForegroundColor Yellow

# Test redirect route (should return 404 for non-existent code)
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/c/test-invalid-code" -Method GET -MaximumRedirection 0 -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "  ✓ Redirect route /c/[id] is responding (returned 404 for invalid code)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Redirect route returned: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

# Test codes API (should require auth)
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/codes" -Method POST -ContentType "application/json" -Body '{"destination":"https://example.com"}' -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  ✓ /api/codes endpoint exists and requires authentication" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ /api/codes endpoint returned: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run the migration in Supabase SQL Editor:" -ForegroundColor White
Write-Host "   supabase_migrations\13_CREATE_QRCODES_TABLE.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Verify table was created:" -ForegroundColor White
Write-Host "   SELECT * FROM public.qrcodes LIMIT 5;" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Test dynamic code creation:" -ForegroundColor White
Write-Host "   - Login to your app" -ForegroundColor Gray
Write-Host "   - Go to QR Code Generator" -ForegroundColor Gray
Write-Host "   - Enable Dynamic QR Code toggle" -ForegroundColor Gray
Write-Host "   - Generate a code" -ForegroundColor Gray
Write-Host "   - You should get a short URL" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test redirect and analytics:" -ForegroundColor White
Write-Host "   - Visit the short URL" -ForegroundColor Gray
Write-Host "   - Should redirect to your destination" -ForegroundColor Gray
Write-Host "   - Check scan count increased in database" -ForegroundColor Gray
Write-Host ""
