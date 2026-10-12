#!/usr/bin/env bash

# ========================================================
# Emgraphic Studio - VPS Avtomatlaşdırılmış Quraşdırma Skripti
# Ubuntu 20.04 / 22.04 / 24.04 üçün nəzərdə tutulub
# ========================================================

set -e

echo "🚀 [1/5] Server paketləri yoxlanılır və yenilənir..."
sudo apt-get update -y

# Node.js 20.x yoxlanışı
if ! command -v node &> /dev/null; then
    echo "📦 Node.js tapılmadı. Node.js LTS quraşdırılır..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js versiyası: $(node -v)"
echo "✅ NPM versiyası: $(npm -v)"

# PM2 yoxlanışı
if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2 tapılmadı. Qlobal olaraq quraşdırılır..."
    sudo npm install -g pm2
fi

# Nginx yoxlanışı
if ! command -v nginx &> /dev/null; then
    echo "📦 Nginx quraşdırılır..."
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

# Certbot (Pulsuz SSL üçün)
if ! command -v certbot &> /dev/null; then
    echo "📦 Certbot (SSL) quraşdırılır..."
    sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "📦 [2/5] Layihənin asılılıqları quraşdırılır (npm install)..."
npm install

echo "🔨 [3/5] İstehsalat paketi yığılır (npm run build)..."
npm run build

echo "📁 [4/5] Lazımi qovluqlar yaradılır..."
mkdir -p logs data

echo "🔄 [5/5] PM2 ilə server işə salınır..."
pm2 start ecosystem.config.cjs --env production || pm2 reload emgraphic-studio

pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

echo ""
echo "========================================================"
echo "🎉 TƏBRİKLƏR! Emgraphic Studio VPS-də uğurla işə düşdü!"
echo "Port: 3000 (Localhost)"
echo ""
echo "Növbəti addımlar:"
echo "1. Nginx konfiqurasiyasını köçürün:"
echo "   sudo cp nginx.conf.example /etc/nginx/sites-available/emgraphic"
echo "   sudo ln -s /etc/nginx/sites-available/emgraphic /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "2. Pulsuz HTTPS (SSL) qoşun:"
echo "   sudo certbot --nginx -d emgraphic.az -d www.emgraphic.az"
echo "========================================================"
