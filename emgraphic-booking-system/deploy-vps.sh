#!/usr/bin/env bash

# ========================================================
# Emgraphic Studio - VPS Avtomatlaşdırılmış Quraşdırma Skripti
# Ubuntu 22.04 / 24.04 üçün nəzərdə tutulub
# ========================================================

set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
umask 077

if [ ! -s package-lock.json ]; then
    echo "package-lock.json yoxdur. Yoxlanmış yerləşdirmə paketindən istifadə edin."
    exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
    echo "Skripti root deyil, sudo hüququ olan ubuntu istifadəçisi ilə başladın."
    exit 1
fi

if [ ! -f .env ] && [ -z "${ADMIN_KEY:-}" ]; then
    echo "Əvvəlcə .env.example faylını .env olaraq köçürün və ADMIN_KEY təyin edin."
    exit 1
fi

echo "🚀 [1/5] Server paketləri yoxlanılır və yenilənir..."
sudo apt-get update -y

# Node.js 24 LTS (Vite 8 üçün müasir Node.js tələb olunur)
sudo apt-get install -y ca-certificates curl
if ! command -v node &> /dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
    echo "📦 Node.js tapılmadı. Node.js LTS quraşdırılır..."
    node_setup="$(mktemp)"
    trap 'rm -f -- "$node_setup"' EXIT
    curl -fsSL https://deb.nodesource.com/setup_24.x -o "$node_setup"
    sudo -E bash "$node_setup"
    sudo apt-get install -y nodejs
fi

expected_npm="$(node -p 'require("./package.json").packageManager.replace(/^npm@/, "")')"
if [[ ! "$expected_npm" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "packageManager daxilində düzgün npm versiyası yoxdur."
    exit 1
fi
if [ "$(npm -v)" != "$expected_npm" ]; then
    sudo npm install --global "npm@$expected_npm" --registry=https://registry.npmjs.org --no-fund --no-audit
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

echo "📦 [2/5] Kilid faylındakı asılılıqlar quraşdırılır (npm ci)..."
if [ "${PREBUILT:-0}" = 1 ]; then
    npm ci --omit=dev --no-fund
else
    npm ci --no-fund
fi

# ADMIN_KEY dəyərini jurnala çıxarmadan yoxla.
node --input-type=module -e 'import "dotenv/config"; if (!process.env.ADMIN_KEY?.trim()) { console.error("ADMIN_KEY təyin edilməyib."); process.exit(1); }'
if [ -f .env ]; then chmod 600 .env; fi

echo "🔨 [3/5] İstehsalat paketi yığılır (npm run build)..."
if [ "${PREBUILT:-0}" = 1 ]; then
    test -s server.js && test -s dist/index.html
else
    npm run lint
    npm run build
    npm run test:api
fi

echo "📁 [4/5] Lazımi qovluqlar yaradılır..."
mkdir -p logs data

echo "🔄 [5/5] PM2 ilə server işə salınır..."
pm2 startOrRestart ecosystem.config.cjs --env production --update-env

pm2 save
sudo env "PATH=$PATH:/usr/bin" pm2 startup systemd -u "$(id -un)" --hp "$HOME"

for attempt in {1..30}; do
    if curl --fail --silent --max-time 3 http://127.0.0.1:3000/api/time | node --input-type=module -e 'let s=""; for await (const c of process.stdin) s+=c; if(JSON.parse(s).timeZone!=="Asia/Baku") process.exit(1);'; then
        break
    fi
    if [ "$attempt" -eq 30 ]; then
        echo "Server yoxlamadan keçmədi. PM2 jurnalını yoxlayın."
        exit 1
    fi
    sleep 1
done
curl --fail --silent --max-time 5 http://127.0.0.1:3000/ -o /dev/null

echo ""
echo "========================================================"
echo "Tətbiq VPS daxilində işə düşdü və yoxlamadan keçdi."
echo "Port: 3000 (Localhost)"
echo ""
echo "Növbəti addımlar:"
echo "1. Nginx konfiqurasiyasını köçürün:"
echo "   sudo cp nginx.conf.example /etc/nginx/sites-available/emgraphic"
echo "   sudo ln -s /etc/nginx/sites-available/emgraphic /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "2. Pulsuz HTTPS (SSL) qoşun:"
echo "   sudo certbot --nginx -d SIZIN_DOMEN"
echo "Sayt yalnız Nginx, domen, HTTPS və Oracle şəbəkəsi yoxlanıldıqdan sonra internetdə hazırdır."
echo "========================================================"
