# =============================================================================
# SmartQRCode Deployment Script (PowerShell + PuTTY)
# =============================================================================
# This script deploys the SmartQRCode application to a remote server via PuTTY
# 
# Prerequisites:
#   - PuTTY installed (plink.exe in PATH or specify full path)
#   - Download from: https://www.putty.org/
#
# Usage:
#   1. Edit the CONFIGURATION section below with your server details
#   2. Run: .\deploy.ps1 [command]
#
# Commands:
#   deploy  - Full deployment (default)
#   update  - Pull latest and redeploy
#   logs    - View application logs
#   restart - Restart the application
#   stop    - Stop the application
#   status  - Check application status
#   ssh     - Open PuTTY session
#   test    - Test SSH connection
#
# =============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "update", "logs", "restart", "stop", "status", "ssh", "test")]
    [string]$Command = "deploy"
)

# =============================================================================
# CONFIGURATION - EDIT THESE VALUES
# =============================================================================

$Config = @{
    # Server connection
    ServerIP    = "194.163.137.196"        # e.g., "192.168.1.100" or "server.example.com"
    ServerUser  = "root"                   # e.g., "root", "ubuntu"
    SSHPort     = "22"
    
    # PuTTY Authentication (choose ONE method):
    # Option 1: Use a saved PuTTY session name (recommended - set it up in PuTTY first)
    PuttySession = ""                      # e.g., "MyServer" - name of saved session in PuTTY
    
    # Option 2: Use PPK private key file
    PPKKeyFile  = ""                       # e.g., "C:\Users\yusuf\.ssh\myserver.ppk"
    
    # PuTTY executable paths (update if not in system PATH)
    PlinkPath   = "plink.exe"              # or "C:\Program Files\PuTTY\plink.exe"
    PuttyPath   = "putty.exe"              # or "C:\Program Files\PuTTY\putty.exe"
    
    # Application settings
    AppName     = "smartqrcode"
    AppDir      = "/var/www/smartqrcode"
    Domain      = "scabmagic.online"
    GitRepo     = "https://github.com/Homeboy20/smartqrcode.git"
    GitBranch   = "master"
    
    # Deployment method: "docker" or "nodejs"
    DeployMethod = "docker"
}

# =============================================================================
# ENVIRONMENT VARIABLES - EDIT THESE VALUES
# =============================================================================

$EnvVars = @{
    # Firebase Client (Public - embedded in build)
    NEXT_PUBLIC_FIREBASE_API_KEY = "AIzaSyAI8KpMU-NK2VG2yGC6BAQ_v0imrbHh79I"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "smartqrdatabase-b5076.firebaseapp.com"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID = "smartqrdatabase-b5076"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "smartqrdatabase-b5076.firebasestorage.app"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "340286816273"
    NEXT_PUBLIC_FIREBASE_APP_ID = "1:340286816273:web:445441f6b1dceb23c2b1b0"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-SQCWHRR10N"
    
    # Firebase Admin (Server-side only)
    FIREBASE_PROJECT_ID = "smartqrdatabase-b5076"
    FIREBASE_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@smartqrdatabase-b5076.iam.gserviceaccount.com"
    FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCQVX7i/IumEdg9\na9NtAhKgcJonrUZivsnYk95IBE1nDcj4zlZyI2hjQHcBgdT93v0ercbO1m33nNYx\nUql5zCEM4HRfOH0OBiK3gfwWF6ilT6P6r3S1eb8bWrwh0B2DQMNzPWbVdlmbBaEu\nEhp/1yavsAl5inXxK/tHgdfWKiVHP+nRvLdpwG9+ISwfywB1+BoQ1o4Hvc/OZzp6\nbLgMXUCWCJpwVDrAQSqbY2a7xQwt9/4j3jEbIoyRfHauNFgsEmdz9fdOqF6YPTuM\n22hdboss2c2DOxL2JKwBv74iez3vo0HQ+zvFwkvN/Rs44fSjMWPK2gvt9Q4NDw33\nBO3pCseZAgMBAAECggEAA2dYvi6ZdnmeQViNHFl7qfft0ri127dHGEnoaIddcewz\nzJZFGJz4JbsL82el57S+AF61vQP2hOvYa0JZR8uGDgEvDV3OKSoA4JX6pWS6b+eQ\nZOWFWZA87v61SBDZ2VIKKeoNRkRruYmo8uavZEtlGKiMmKaowF66psWLmvvUdDkn\nD/jTqw8jBlHnOgk+OJ2eByvkI19bgWAubrXo0lVvuTTfPq9hWN/B2UCNhwfq3Ggl\nTW/9h8sb78Cw+wvlckafoWEiP0o2yPhZUraggPfZFDD0cSSDtWYZGgQunVp9eTvh\nzEtkf2ac3HpTH9GHnbpAZfde+xjLZN5A19+ZpSQ/gQKBgQDBOU9lWkouZol+wVUD\n7lYYUOAOfnChoUbhLwlslbCuvOHI7bgv3iVJILyEhuSHGFirwiNWZxmvB5cgED7a\nmIv0CjcOqflonSoamBsbi5FZ/bmmpOWOsNfTmv7d+xLUJFzHZf0+y2tWzFtZnDdJ\nXM4JNuFWWtDr2PmFmUcTMtuWYQKBgQC/OfJO2Wl8ZjOfIkFFBYwzej2sTILzlUjM\nGjfkJTfdheaOqgL72boIPOI4U5zfeKzeqrrG3K06J9CC+EEbfNIU/xx5wiyWilVB\nFJAP7jahkNlRVu3EORMecvbFOy9LnCyMxmUih7JuUwOiSCnkoJopGQU5WTQenX2v\nxJ1iqfHMOQKBgGqL2ZX/xav0apj0rpZuVBcwcXxMiHr33YfKUh4IJNcV3ELZopjy\nnAjI/mrtnxJHgI2ljarVSzpSqyjJDH+pYnL9NwLlA1yGXXMwsLHtsga3fCnB/7tB\nFKHgc+2fxvAn5Okm+hAoR1YjdbPiCjJv9ETseDEP/uguStk6fhC+GIvBAoGBALFZ\nX6XLM27hJm0nCtulqoKvk3UxvJ2GTW6lvkJEVkyH++1CNeQ36LXtKW1N9oa3V7Rn\nKTR3w9zUwihFb7S7jedVNqah9FJl1221UWrE5jvvp+0tLvS2bknmG4GOQ23fWN3y\nvidJLK3vJcajIN9eJ7uH7fVjCth9/ew+8CxqKsvZAoGANE5/TKYDY9YwCkUSffu+\ncEQW7HHPRfhM3zlo0BlHbK8/yHc95I20E8SCkvvmIBS5Dyl+EPuoVvDrb81jsRD6\n2CG90ATkSIeNbMFK1g5q5Tk3ZlxAbHlFKPFWR57lVOZblfLi4dHw3N0iUUqMFPug\n8GkQYt0nqrHIIMb21T+zf0g=\n-----END PRIVATE KEY-----\n"
    
    # App URL (auto-set from Domain if empty)
    NEXT_PUBLIC_APP_URL = ""
    
    # Admin Setup Secret (generate, then remove after first admin created)
    # Generate with: [guid]::NewGuid().ToString().Replace("-","")
    ADMIN_SETUP_SECRET = ""
    
    # Stripe (optional)
    STRIPE_SECRET_KEY = ""
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY = ""
}

# Set App URL from domain if not specified
if ([string]::IsNullOrEmpty($EnvVars.NEXT_PUBLIC_APP_URL)) {
    $EnvVars.NEXT_PUBLIC_APP_URL = "https://$($Config.Domain)"
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

function Write-Info($msg) { Write-Host "[INFO] " -ForegroundColor Blue -NoNewline; Write-Host $msg }
function Write-Success($msg) { Write-Host "[SUCCESS] " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Warn($msg) { Write-Host "[WARNING] " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err($msg) { Write-Host "[ERROR] " -ForegroundColor Red -NoNewline; Write-Host $msg }

function Get-PlinkCommand {
    $plinkArgs = @()
    
    # Use saved PuTTY session if specified
    if (-not [string]::IsNullOrEmpty($Config.PuttySession)) {
        $plinkArgs += "-load"
        $plinkArgs += $Config.PuttySession
    } else {
        # Build connection from individual settings
        $plinkArgs += "-P"
        $plinkArgs += $Config.SSHPort
        
        # Add PPK key if specified
        if (-not [string]::IsNullOrEmpty($Config.PPKKeyFile)) {
            $plinkArgs += "-i"
            $plinkArgs += $Config.PPKKeyFile
        }
        
        $plinkArgs += "$($Config.ServerUser)@$($Config.ServerIP)"
    }
    
    return $plinkArgs
}

function Invoke-RemoteCommand {
    param([string]$RemoteCmd)
    
    $plinkArgs = Get-PlinkCommand
    
    # Add batch mode to avoid prompts
    $allArgs = @("-batch") + $plinkArgs + @($RemoteCmd)
    
    try {
        $result = & $Config.PlinkPath $allArgs 2>&1
        return $result
    } catch {
        Write-Err "Command failed: $_"
        return $null
    }
}

function Test-Configuration {
    Write-Info "Validating configuration..."
    
    if ($Config.ServerIP -eq "YOUR_SERVER_IP") {
        Write-Err "Please set ServerIP in the configuration section"
        return $false
    }
    
    if ([string]::IsNullOrEmpty($EnvVars.NEXT_PUBLIC_FIREBASE_API_KEY)) {
        Write-Err "Please set Firebase environment variables"
        return $false
    }
    
    # Check if plink.exe exists
    $plinkExists = $false
    try {
        $null = & $Config.PlinkPath -V 2>&1
        $plinkExists = $true
    } catch {
        # Try common PuTTY installation paths
        $commonPaths = @(
            "C:\Program Files\PuTTY\plink.exe",
            "C:\Program Files (x86)\PuTTY\plink.exe",
            "$env:USERPROFILE\AppData\Local\Programs\PuTTY\plink.exe"
        )
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                $Config.PlinkPath = $path
                $Config.PuttyPath = $path -replace "plink", "putty"
                $plinkExists = $true
                Write-Info "Found PuTTY at: $path"
                break
            }
        }
    }
    
    if (-not $plinkExists) {
        Write-Err "plink.exe not found!"
        Write-Host ""
        Write-Host "Please install PuTTY:" -ForegroundColor Yellow
        Write-Host "  1. Download from: https://www.putty.org/"
        Write-Host "  2. Install with default settings"
        Write-Host "  3. Or set full path in Config.PlinkPath"
        return $false
    }
    
    Write-Success "Configuration validated"
    return $true
}

function Test-SSHConnection {
    Write-Info "Testing SSH connection to $($Config.ServerUser)@$($Config.ServerIP)..."
    Write-Info "(You may need to accept the host key on first connection)"
    
    # First, try to cache the host key
    $plinkArgs = Get-PlinkCommand
    $result = & $Config.PlinkPath $plinkArgs "echo CONNECTION_SUCCESS" 2>&1
    
    if ($result -match "CONNECTION_SUCCESS") {
        Write-Success "SSH connection successful!"
        return $true
    } else {
        Write-Err "SSH connection failed"
        Write-Host $result -ForegroundColor DarkGray
        Write-Host ""
        Write-Info "Troubleshooting:"
        Write-Host "  1. Try connecting with PuTTY GUI first to cache the host key"
        Write-Host "  2. Check your server IP and credentials"
        Write-Host "  3. If using PPK key, verify the file path"
        Write-Host "  4. Save a session in PuTTY and use PuttySession config"
        return $false
    }
}

# =============================================================================
# SERVER SETUP FUNCTIONS
# =============================================================================

function Setup-ServerDocker {
    Write-Info "Setting up server with Docker (this may take a few minutes)..."
    
    $commands = @(
        "apt-get update",
        "apt-get install -y curl git",
        "command -v docker || curl -fsSL https://get.docker.com | sh",
        "systemctl enable docker && systemctl start docker",
        "command -v docker-compose || (curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-Linux-x86_64 -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose)",
        "apt-get install -y nginx certbot python3-certbot-nginx",
        "systemctl enable nginx",
        "mkdir -p $($Config.AppDir)"
    )
    
    foreach ($cmd in $commands) {
        Write-Host "  > $cmd" -ForegroundColor DarkGray
        $result = Invoke-RemoteCommand -RemoteCmd $cmd
        if ($result) { 
            $result | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    }
    
    Write-Success "Server setup complete (Docker)"
}

function Setup-ServerNodejs {
    Write-Info "Setting up server with Node.js (this may take a few minutes)..."
    
    $commands = @(
        "apt-get update",
        "apt-get install -y curl git",
        "command -v node || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)",
        "npm install -g pm2",
        "pm2 startup || true",
        "apt-get install -y nginx certbot python3-certbot-nginx",
        "systemctl enable nginx",
        "mkdir -p $($Config.AppDir)"
    )
    
    foreach ($cmd in $commands) {
        Write-Host "  > $cmd" -ForegroundColor DarkGray
        $result = Invoke-RemoteCommand -RemoteCmd $cmd
        if ($result) { 
            $result | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    }
    
    Write-Success "Server setup complete (Node.js)"
}

# =============================================================================
# DEPLOYMENT FUNCTIONS
# =============================================================================

function Create-EnvFile {
    Write-Info "Creating environment file on server..."
    
    $envContent = @"
# Generated by deploy.ps1 on $(Get-Date -Format "yyyy-MM-dd HH:mm")
NODE_ENV=production

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=$($EnvVars.NEXT_PUBLIC_FIREBASE_API_KEY)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$($EnvVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$($EnvVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$($EnvVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$($EnvVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)
NEXT_PUBLIC_FIREBASE_APP_ID=$($EnvVars.NEXT_PUBLIC_FIREBASE_APP_ID)
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$($EnvVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID)

# Firebase Admin
FIREBASE_PROJECT_ID=$($EnvVars.FIREBASE_PROJECT_ID)
FIREBASE_CLIENT_EMAIL=$($EnvVars.FIREBASE_CLIENT_EMAIL)
FIREBASE_PRIVATE_KEY="$($EnvVars.FIREBASE_PRIVATE_KEY)"

# App
NEXT_PUBLIC_APP_URL=$($EnvVars.NEXT_PUBLIC_APP_URL)
ADMIN_SETUP_SECRET=$($EnvVars.ADMIN_SETUP_SECRET)

# Stripe
STRIPE_SECRET_KEY=$($EnvVars.STRIPE_SECRET_KEY)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=$($EnvVars.NEXT_PUBLIC_STRIPE_PUBLIC_KEY)
"@
    
    # Write env file using heredoc
    $cmd = "cat > $($Config.AppDir)/.env << 'ENVEOF'`n$envContent`nENVEOF"
    Invoke-RemoteCommand -RemoteCmd $cmd
    
    Write-Success "Environment file created"
}

function Deploy-Docker {
    Write-Info "Deploying with Docker (this may take several minutes on first run)..."
    
    $commands = @(
        "cd $($Config.AppDir) && ([ -d .git ] && git fetch origin && git reset --hard origin/$($Config.GitBranch) || git clone -b $($Config.GitBranch) $($Config.GitRepo) .)",
        "cd $($Config.AppDir) && cp .env .env.local",
        "cd $($Config.AppDir) && docker-compose down 2>/dev/null || true",
        "cd $($Config.AppDir) && docker-compose build --no-cache",
        "cd $($Config.AppDir) && docker-compose up -d",
        "docker image prune -f"
    )
    
    foreach ($cmd in $commands) {
        Write-Host "  > $($cmd.Substring(0, [Math]::Min(60, $cmd.Length)))..." -ForegroundColor DarkGray
        $result = Invoke-RemoteCommand -RemoteCmd $cmd
        if ($result) { 
            $result | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    }
    
    Write-Success "Docker deployment complete"
}

function Deploy-Nodejs {
    Write-Info "Deploying with Node.js/PM2 (this may take several minutes)..."
    
    $commands = @(
        "cd $($Config.AppDir) && ([ -d .git ] && git fetch origin && git reset --hard origin/$($Config.GitBranch) || git clone -b $($Config.GitBranch) $($Config.GitRepo) .)",
        "cd $($Config.AppDir) && cp .env .env.local",
        "cd $($Config.AppDir) && npm ci",
        "cd $($Config.AppDir) && npm run build",
        "pm2 delete $($Config.AppName) 2>/dev/null || true",
        "cd $($Config.AppDir) && pm2 start npm --name $($Config.AppName) -- start",
        "pm2 save"
    )
    
    foreach ($cmd in $commands) {
        Write-Host "  > $($cmd.Substring(0, [Math]::Min(60, $cmd.Length)))..." -ForegroundColor DarkGray
        $result = Invoke-RemoteCommand -RemoteCmd $cmd
        if ($result) { 
            $result | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    }
    
    Write-Success "Node.js deployment complete"
}

function Setup-Nginx {
    Write-Info "Configuring Nginx reverse proxy..."
    
    # Create nginx config
    $cmd1 = "echo 'server { listen 80; server_name $($Config.Domain) www.$($Config.Domain); location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1; proxy_set_header Upgrade `$http_upgrade; proxy_set_header Connection upgrade; proxy_set_header Host `$host; proxy_set_header X-Real-IP `$remote_addr; proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto `$scheme; proxy_cache_bypass `$http_upgrade; proxy_read_timeout 86400; } }' > /etc/nginx/sites-available/$($Config.AppName)"
    Invoke-RemoteCommand -RemoteCmd $cmd1
    Invoke-RemoteCommand -RemoteCmd "ln -sf /etc/nginx/sites-available/$($Config.AppName) /etc/nginx/sites-enabled/"
    Invoke-RemoteCommand -RemoteCmd "rm -f /etc/nginx/sites-enabled/default"
    Invoke-RemoteCommand -RemoteCmd "nginx -t && systemctl reload nginx"
    
    Write-Success "Nginx configured"
}

function Setup-SSL {
    Write-Info "Setting up SSL certificate with Certbot..."
    Write-Info "Make sure your domain DNS points to this server first!"
    
    $result = Invoke-RemoteCommand -RemoteCmd "certbot --nginx -d $($Config.Domain) --non-interactive --agree-tos --email admin@$($Config.Domain) || true"
    if ($result) { Write-Host $result }
    
    Invoke-RemoteCommand -RemoteCmd "systemctl reload nginx"
    Write-Success "SSL setup complete"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  SmartQRCode Deployment (PuTTY/Plink)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

switch ($Command) {
    "test" {
        if (-not (Test-Configuration)) { exit 1 }
        Test-SSHConnection
    }
    
    "deploy" {
        if (-not (Test-Configuration)) { exit 1 }
        if (-not (Test-SSHConnection)) { exit 1 }
        
        if ($Config.DeployMethod -eq "docker") {
            Setup-ServerDocker
        } else {
            Setup-ServerNodejs
        }
        
        Create-EnvFile
        
        if ($Config.DeployMethod -eq "docker") {
            Deploy-Docker
        } else {
            Deploy-Nodejs
        }
        
        Setup-Nginx
        
        Write-Host ""
        $sslChoice = Read-Host "Setup SSL certificate? (y/n)"
        if ($sslChoice -eq "y") {
            Setup-SSL
        }
        
        Write-Host ""
        Write-Host "==============================================" -ForegroundColor Green
        Write-Success "Deployment complete!"
        Write-Host "==============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your app is available at:" -ForegroundColor White
        Write-Host "  http://$($Config.Domain)" -ForegroundColor Cyan
        Write-Host "  https://$($Config.Domain) (if SSL configured)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Point your domain DNS A record to: $($Config.ServerIP)"
        Write-Host "  2. Visit https://$($Config.Domain)/secure-admin-setup"
        Write-Host "  3. Enter your ADMIN_SETUP_SECRET to create admin"
        Write-Host "  4. Remove ADMIN_SETUP_SECRET from this script after setup"
    }
    
    "update" {
        if (-not (Test-Configuration)) { exit 1 }
        Write-Info "Updating application..."
        Create-EnvFile
        if ($Config.DeployMethod -eq "docker") {
            Deploy-Docker
        } else {
            Deploy-Nodejs
        }
        Write-Success "Update complete!"
    }
    
    "logs" {
        if (-not (Test-Configuration)) { exit 1 }
        Write-Info "Fetching logs..."
        if ($Config.DeployMethod -eq "docker") {
            $result = Invoke-RemoteCommand -RemoteCmd "cd $($Config.AppDir) && docker-compose logs --tail=50"
        } else {
            $result = Invoke-RemoteCommand -RemoteCmd "pm2 logs $($Config.AppName) --lines 50 --nostream"
        }
        if ($result) { $result | ForEach-Object { Write-Host $_ } }
    }
    
    "restart" {
        if (-not (Test-Configuration)) { exit 1 }
        Write-Info "Restarting application..."
        if ($Config.DeployMethod -eq "docker") {
            Invoke-RemoteCommand -RemoteCmd "cd $($Config.AppDir) && docker-compose restart"
        } else {
            Invoke-RemoteCommand -RemoteCmd "pm2 restart $($Config.AppName)"
        }
        Write-Success "Application restarted"
    }
    
    "stop" {
        if (-not (Test-Configuration)) { exit 1 }
        Write-Info "Stopping application..."
        if ($Config.DeployMethod -eq "docker") {
            Invoke-RemoteCommand -RemoteCmd "cd $($Config.AppDir) && docker-compose down"
        } else {
            Invoke-RemoteCommand -RemoteCmd "pm2 stop $($Config.AppName)"
        }
        Write-Success "Application stopped"
    }
    
    "status" {
        if (-not (Test-Configuration)) { exit 1 }
        Write-Info "Checking application status..."
        if ($Config.DeployMethod -eq "docker") {
            $result = Invoke-RemoteCommand -RemoteCmd "cd $($Config.AppDir) && docker-compose ps"
        } else {
            $result = Invoke-RemoteCommand -RemoteCmd "pm2 status"
        }
        if ($result) { $result | ForEach-Object { Write-Host $_ } }
    }
    
    "ssh" {
        Write-Info "Opening PuTTY session..."
        if (-not [string]::IsNullOrEmpty($Config.PuttySession)) {
            Start-Process $Config.PuttyPath -ArgumentList "-load `"$($Config.PuttySession)`""
        } else {
            $args = "-P $($Config.SSHPort)"
            if (-not [string]::IsNullOrEmpty($Config.PPKKeyFile)) {
                $args += " -i `"$($Config.PPKKeyFile)`""
            }
            $args += " $($Config.ServerUser)@$($Config.ServerIP)"
            Start-Process $Config.PuttyPath -ArgumentList $args
        }
    }
}
}
