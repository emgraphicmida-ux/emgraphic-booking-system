# 🚀 Emgraphic Studio — VPS Serverdə Canlı Domenlə Quraşdırma Təlimatı (Variant B)

Bu təlimat vasitəsilə siz saytı istənilən **Ubuntu VPS serverində** (DigitalOcean, Hetzner, Hostinger, Linode və s.) öz rəsmi domeninizlə (**məs: `emgraphic.az`**) tam işlək vəziyyətə gətirə bilərsiniz.

---

## 📋 Lazım Olanlar:
1. **Domen adı:** (Məs: `emgraphic.az` — Online.az və ya digər provayderdən alınmış).
2. **Ubuntu VPS Server:** (Ubuntu 22.04 və ya 24.04 LTS, 1GB-2GB RAM kifayətdir, aylıq ~4-5$).
3. **Serverin IP Ünvanı:** (Məs: `123.45.67.89`).

---

## 1-ci Addım: Domeni Serverin IP-sinə Bağlayın (DNS)

Domeni aldığınız idarəetmə panelinə (DNS Management) daxil olun və 2 qeyd əlavə edin:

| Tip | Ad (Host) | Dəyər (Value / Points to) | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (və ya boş) | `Sizin_Serverin_IP_Ünvanı` (məs: `123.45.67.89`) | 3600 (Auto) |
| **CNAME** | `www` | `emgraphic.az` | 3600 (Auto) |

*(Qeyd: DNS dəyişikliklərinin bütün dünyada aktiv olması adətən 10-30 dəqiqə çəkir).*

---

## 2-ci Addım: Serverə SSH ilə Daxil Olun

Kompüterinizin terminalından (Windows üçün PowerShell və ya PuTTY, Mac/Linux üçün Terminal) serverə qoşulun:

```bash
ssh root@SERVERIN_IP_ÜNVANI
```

---

## 3-cü Addım: Layihə Fayllarını Serverə Köçürün

Serverdə layihə üçün qovluq açın və kodları ora yerləşdirin:

```bash
# Qovluq yaradın
mkdir -p /var/www/emgraphic
cd /var/www/emgraphic
```

*(Kodları GitHub vasitəsilə `git clone ... .` edə və ya kompüterinizdən ZIP/SCP vasitəsilə birbaşa bura köçürə bilərsiniz).*

---

## 4-cü Addım: Bir Əmrlə Avtomatik Quraşdırma

Biz layihəyə xüsusi avtomatlaşdırılmış skript əlavə etmişik. Sadəcə bu əmri icra edin:

```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

**Bu skript sizin yerinizə:**
* Node.js, PM2, Nginx və Certbot proqramlarını quraşdıracaq;
* Bütün asılılıqları yükləyəcək (`npm install`);
* Saytın istehsalat paketini yığacaq (`npm run build`);
* PM2 ilə tətbiqi arxa fonda daimi işə salacaq və server sönüb-yandıqda avtomatik yenidən açılmasını təmin edəcək.

---

## 5-ci Addım: Nginx Vasitəsilə Domeni Qoşun

1. Nginx konfiqurasiya faylını açın və domen adınızı qeyd edin:
```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/emgraphic
sudo nano /etc/nginx/sites-available/emgraphic
```
*(Fayldakı `emgraphic.az www.emgraphic.az` yerinə öz domen adınızı yazıb `Ctrl+O`, `Enter`, `Ctrl+X` ilə yadda saxlayın).*

2. Saytı Nginx-də aktivləşdirin və yeniləyin:
```bash
sudo ln -s /etc/nginx/sites-available/emgraphic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6-cı Addım: Pulsuz HTTPS (SSL Yaşıl Qıfıl) Sertifikatı

Saytın brauzerlərdə təhlükəsiz (HTTPS) açılması üçün Certbot ilə pulsuz SSL qoşun:

```bash
sudo certbot --nginx -d emgraphic.az -d www.emgraphic.az
```
*Sizdən email ünvanı istəyəcək, daxil edin və şərtləri təsdiqləyin (`Y`). Certbot avtomatik olaraq HTTPS-i qoşacaq və müddəti bitdikdə özü yeniləyəcək!*

---

## 🎉 NƏTİCƏ:

* **Müştəri Saytı:** `https://emgraphic.az/`
  *(Müştərilər üçün tam təmiz, təqvim, canlı saatlar, WhatsApp əlaqəsi).*
* **Studiya Rəhbərinin Gizli Admin Portalı:** `https://emgraphic.az/?admin`
  *(Şifrə: `emgraphic2026` — Sifarişləri idarə etmək, Excel yükləmək, WhatsApp nömrəsini dəyişmək üçün).*

---

## 🔧 Faydalı Server Əmrləri (Gələcək üçün):
* **Serverin canlı vəziyyətinə baxmaq:** `pm2 status`
* **Canlı logları (sifarişləri) izləmək:** `pm2 logs`
* **Saytı yenidən başlatmaq:** `pm2 restart emgraphic-studio`
* **Kodu yenilədikdə təkrar yığmaq:** `npm run build && pm2 reload emgraphic-studio`
