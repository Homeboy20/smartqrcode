#!/bin/bash

# =============================================================================
# SmartQRCode Deployment Script
# =============================================================================
# This script deploys the SmartQRCode application to a remote server via SSH
# 
# Usage:
#   1. Edit the CONFIGURATION section below with your server details
#   2. Make executable: chmod +x deploy.sh
#   3. Run: ./deploy.sh
#
# Requirements on local machine:
#   - SSH access to the server
#   - Git installed
#
# =============================================================================

set -e  # Exit on any error

# =============================================================================
# CONFIGURATION - EDIT THESE VALUES
# =============================================================================

# Server connection
SERVER_IP="YOUR_SERVER_IP"           # e.g., "192.168.1.100" or "server.example.com"
SERVER_USER="root"                    # e.g., "root", "ubuntu", "deploy"
SSH_PORT="22"                         # Default SSH port
SSH_KEY=""                            # Path to SSH key (leave empty for password auth)
                                      # e.g., "~/.ssh/id_rsa"

# Application settings
APP_NAME="smartqrcode"
APP_DIR="/var/www/smartqrcode"        # Where to deploy on server
DOMAIN="your-domain.com"              # Your domain name
GIT_REPO="https://github.com/Homeboy20/smartqrcode.git"
GIT_BRANCH="master"

# Deployment method: "docker" or "nodejs"
DEPLOY_METHOD="docker"

# Node.js version (only for nodejs deployment)
NODE_VERSION="20"

# =============================================================================
# ENVIRONMENT VARIABLES - EDIT THESE VALUES
# =============================================================================

# Firebase Client (Public - embedded in build)
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=""

# Firebase Admin (Server-side only)
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""  # Include the full key with \n characters

# App URL
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"

# Admin Setup (temporary - remove after creating first admin)
ADMIN_SETUP_SECRET=""  # Generate with: openssl rand -hex 32

# Payment providers (optional)
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=""
STRIPE_WEBHOOK_SECRET=""

# =============================================================================
# COLORS FOR OUTPUT
# =============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build SSH command
get_ssh_cmd() {
    if [ -n "$SSH_KEY" ]; then
        echo "ssh -i $SSH_KEY -p $SSH_PORT $SERVER_USER@$SERVER_IP"
    else
        echo "ssh -p $SSH_PORT $SERVER_USER@$SERVER_IP"
    fi
}

# Execute command on remote server
remote_exec() {
    local cmd=$1
    $(get_ssh_cmd) "$cmd"
}

# =============================================================================
# VALIDATION
# =============================================================================

validate_config() {
    log_info "Validating configuration..."
    
    if [ "$SERVER_IP" = "YOUR_SERVER_IP" ]; then
        log_error "Please set SERVER_IP in the configuration section"
        exit 1
    fi
    
    if [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]; then
        log_error "Please set Firebase environment variables"
        exit 1
    fi
    
    log_success "Configuration validated"
}

# =============================================================================
# SERVER SETUP FUNCTIONS
# =============================================================================

setup_server_docker() {
    log_info "Setting up server with Docker..."
    
    remote_exec "
        # Update system
        apt-get update && apt-get upgrade -y
        
        # Install Docker if not present
        if ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
            systemctl enable docker
            systemctl start docker
        fi
        
        # Install Docker Compose if not present
        if ! command -v docker-compose &> /dev/null; then
            curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        # Install Nginx if not present
        if ! command -v nginx &> /dev/null; then
            apt-get install -y nginx
            systemctl enable nginx
        fi
        
        # Install Certbot for SSL
        if ! command -v certbot &> /dev/null; then
            apt-get install -y certbot python3-certbot-nginx
        fi
        
        # Install Git if not present
        if ! command -v git &> /dev/null; then
            apt-get install -y git
        fi
        
        # Create app directory
        mkdir -p $APP_DIR
    "
    
    log_success "Server setup complete (Docker)"
}

setup_server_nodejs() {
    log_info "Setting up server with Node.js..."
    
    remote_exec "
        # Update system
        apt-get update && apt-get upgrade -y
        
        # Install Node.js if not present
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
            apt-get install -y nodejs
        fi
        
        # Install PM2 globally
        if ! command -v pm2 &> /dev/null; then
            npm install -g pm2
            pm2 startup
        fi
        
        # Install Nginx if not present
        if ! command -v nginx &> /dev/null; then
            apt-get install -y nginx
            systemctl enable nginx
        fi
        
        # Install Certbot for SSL
        if ! command -v certbot &> /dev/null; then
            apt-get install -y certbot python3-certbot-nginx
        fi
        
        # Install Git if not present
        if ! command -v git &> /dev/null; then
            apt-get install -y git
        fi
        
        # Create app directory
        mkdir -p $APP_DIR
    "
    
    log_success "Server setup complete (Node.js)"
}

# =============================================================================
# DEPLOYMENT FUNCTIONS
# =============================================================================

create_env_file() {
    log_info "Creating environment file on server..."
    
    # Escape special characters in private key
    ESCAPED_PRIVATE_KEY=$(echo "$FIREBASE_PRIVATE_KEY" | sed 's/"/\\"/g')
    
    remote_exec "cat > $APP_DIR/.env << 'ENVEOF'
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY=\"$ESCAPED_PRIVATE_KEY\"

# App URL
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Admin Setup (remove after first admin created)
ADMIN_SETUP_SECRET=$ADMIN_SETUP_SECRET

# Stripe (optional)
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=$NEXT_PUBLIC_STRIPE_PUBLIC_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET

# Node environment
NODE_ENV=production
ENVEOF"
    
    log_success "Environment file created"
}

deploy_docker() {
    log_info "Deploying with Docker..."
    
    remote_exec "
        cd $APP_DIR
        
        # Clone or pull repository
        if [ -d '.git' ]; then
            git fetch origin
            git reset --hard origin/$GIT_BRANCH
        else
            git clone -b $GIT_BRANCH $GIT_REPO .
        fi
        
        # Copy env file for docker-compose
        cp .env .env.local
        
        # Build and start containers
        docker-compose down || true
        docker-compose build --no-cache
        docker-compose up -d
        
        # Clean up old images
        docker image prune -f
    "
    
    log_success "Docker deployment complete"
}

deploy_nodejs() {
    log_info "Deploying with Node.js/PM2..."
    
    remote_exec "
        cd $APP_DIR
        
        # Clone or pull repository
        if [ -d '.git' ]; then
            git fetch origin
            git reset --hard origin/$GIT_BRANCH
        else
            git clone -b $GIT_BRANCH $GIT_REPO .
        fi
        
        # Copy env file
        cp .env .env.local
        
        # Install dependencies
        npm ci
        
        # Build application
        npm run build
        
        # Start/restart with PM2
        pm2 delete $APP_NAME || true
        pm2 start npm --name '$APP_NAME' -- start
        pm2 save
    "
    
    log_success "Node.js deployment complete"
}

# =============================================================================
# NGINX CONFIGURATION
# =============================================================================

setup_nginx() {
    log_info "Configuring Nginx..."
    
    remote_exec "cat > /etc/nginx/sites-available/$APP_NAME << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

    # Enable site
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
"
    
    log_success "Nginx configured"
}

setup_ssl() {
    log_info "Setting up SSL with Certbot..."
    
    remote_exec "
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || true
        systemctl reload nginx
    "
    
    log_success "SSL setup complete"
}

# =============================================================================
# MAIN DEPLOYMENT FLOW
# =============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "  SmartQRCode Deployment Script"
    echo "=============================================="
    echo ""
    
    # Validate configuration
    validate_config
    
    # Test SSH connection
    log_info "Testing SSH connection..."
    if ! remote_exec "echo 'SSH connection successful'"; then
        log_error "Failed to connect to server via SSH"
        exit 1
    fi
    log_success "SSH connection verified"
    
    # Setup server based on deployment method
    if [ "$DEPLOY_METHOD" = "docker" ]; then
        setup_server_docker
    else
        setup_server_nodejs
    fi
    
    # Create environment file
    create_env_file
    
    # Deploy application
    if [ "$DEPLOY_METHOD" = "docker" ]; then
        deploy_docker
    else
        deploy_nodejs
    fi
    
    # Setup Nginx
    setup_nginx
    
    # Setup SSL (optional - comment out if not using domain)
    read -p "Setup SSL certificate? (y/n): " setup_ssl_answer
    if [ "$setup_ssl_answer" = "y" ]; then
        setup_ssl
    fi
    
    echo ""
    echo "=============================================="
    log_success "Deployment complete!"
    echo "=============================================="
    echo ""
    echo "Your application should now be available at:"
    echo "  http://$DOMAIN"
    echo "  https://$DOMAIN (if SSL was configured)"
    echo ""
    echo "Next steps:"
    echo "  1. Visit https://$DOMAIN/secure-admin-setup"
    echo "  2. Enter your ADMIN_SETUP_SECRET to create admin"
    echo "  3. Remove ADMIN_SETUP_SECRET from .env after setup"
    echo ""
}

# =============================================================================
# UTILITY COMMANDS
# =============================================================================

case "${1:-deploy}" in
    deploy)
        main
        ;;
    logs)
        if [ "$DEPLOY_METHOD" = "docker" ]; then
            remote_exec "cd $APP_DIR && docker-compose logs -f"
        else
            remote_exec "pm2 logs $APP_NAME"
        fi
        ;;
    restart)
        log_info "Restarting application..."
        if [ "$DEPLOY_METHOD" = "docker" ]; then
            remote_exec "cd $APP_DIR && docker-compose restart"
        else
            remote_exec "pm2 restart $APP_NAME"
        fi
        log_success "Application restarted"
        ;;
    stop)
        log_info "Stopping application..."
        if [ "$DEPLOY_METHOD" = "docker" ]; then
            remote_exec "cd $APP_DIR && docker-compose down"
        else
            remote_exec "pm2 stop $APP_NAME"
        fi
        log_success "Application stopped"
        ;;
    status)
        if [ "$DEPLOY_METHOD" = "docker" ]; then
            remote_exec "cd $APP_DIR && docker-compose ps"
        else
            remote_exec "pm2 status"
        fi
        ;;
    update)
        log_info "Updating application..."
        create_env_file
        if [ "$DEPLOY_METHOD" = "docker" ]; then
            deploy_docker
        else
            deploy_nodejs
        fi
        log_success "Application updated"
        ;;
    ssh)
        log_info "Connecting to server..."
        $(get_ssh_cmd)
        ;;
    *)
        echo "Usage: $0 {deploy|logs|restart|stop|status|update|ssh}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (default)"
        echo "  logs    - View application logs"
        echo "  restart - Restart the application"
        echo "  stop    - Stop the application"
        echo "  status  - Check application status"
        echo "  update  - Pull latest code and redeploy"
        echo "  ssh     - Open SSH session to server"
        exit 1
        ;;
esac
