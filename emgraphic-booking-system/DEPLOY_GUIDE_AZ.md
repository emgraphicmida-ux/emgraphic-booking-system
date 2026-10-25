# Emgraphic Studio — VPS quraşdırılması

Bu əmrləri repository-nin `emgraphic-booking-system/` alt qovluğunda icra edin.

## Hazırlıq

Node.js 24, npm, PM2 və Nginx istifadə olunur. `package.json` daxilində npm versiyası `packageManager` ilə göstərilir; avtomatik quraşdırma skripti həmin rəsmi versiyanı təmin edir. Asılılıqların yeganə kilid faylı `package-lock.json`-dır; Bun və pnpm ilə paralel kilid faylı yaratmayın.

Oracle Always Free üçün ayrıca hazırlıq və köçürmə planı: `ORACLE_DEPLOY_AZ.md`.

```bash
cp .env.example .env
nano .env
```

`ADMIN_KEY` üçün öz inzibatçı şifrənizi təyin edin.
Server `.env` faylını özü oxuyur. Şifrəni GitHub-a göndərməyin.

## Yığmaq və işə salmaq

```bash
npm ci
npm run lint
npm run build
npm run test:api
mkdir -p logs data
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Alternativ quraşdırma skripti: `chmod +x deploy-vps.sh && ./deploy-vps.sh`.

PM2 yığılmış `server.js` faylını işə salır.
Kodu yenilədikdə server də yenidən yığılmalıdır:

```bash
npm run build
pm2 restart emgraphic-studio --update-env
```

## Domen və HTTPS

Domenin A qeydini serverin IP ünvanına bağlayın.
`nginx.conf.example` daxilində domeni dəyişin və Nginx konfiqurasiyasını aktivləşdirin.
Nginx tətbiqə `127.0.0.1:3000` üzərindən qoşulur.

Bu Nginx konfiqurasiyası üçün `.env` faylına `TRUST_PROXY=loopback` əlavə edin.
Node portunu birbaşa internetə çıxarmayın; yalnız yerli Nginx proxy-yə açıq saxlayın.
Proxy istifadə olunmursa, `TRUST_PROXY` təyin etməyin. Beləliklə, müştərinin özü
göndərdiyi saxta `X-Forwarded-For` ünvanı IP kimi qəbul edilmir.

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/emgraphic
sudo ln -s /etc/nginx/sites-available/emgraphic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d SIZIN_DOMEN -d www.SIZIN_DOMEN
```

Müştəri səhifəsi: `https://SIZIN_DOMEN/`.
Admin giriş ekranı: `https://SIZIN_DOMEN/admin`.
Admin şifrəsi `.env` daxilindəki `ADMIN_KEY` dəyəridir.

## Məlumatların saxlanması

`data/` qovluğundakı qeydiyyat və tənzimləmə fayllarını yeniləmə zamanı saxlayın.
VPS üçün `DATA_DIR` ilə tətbiqdən ayrı daimi məlumat qovluğu göstərin, məsələn `/home/ubuntu/emgraphic/data`.
`.env` və məlumat qovluğunun ehtiyat nüsxəsini saxlayın.

## Yeniləmələrin yoxlanması

Asılılıq yeniləmələri ayrıca iş nüsxəsində edilir. `npm install` nəticəsində dəyişən `package-lock.json` da mənbə kodu ilə saxlanılır; sonra `npm audit`, TypeScript, build və API testləri yoxlanılır. VPS və hazır yerləşdirmə paketində həmişə `npm ci` istifadə edin. Beləliklə, server yoxlanmış paket versiyalarını quraşdırır və çatışmayan kilid faylı ilə işləməyi rədd edir.

`body-parser` və `ip-address` təhlükəsizlik düzəlişləri `package.json` daxilindəki dəqiq override versiyaları ilə təmin olunur. Yeni təhlükəsizlik yeniləməsi zamanı bu versiyalar da məqsədli şəkildə yenilənməlidir.
