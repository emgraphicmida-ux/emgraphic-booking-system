# Oracle Cloud yerləşdirmə qeydləri

Bu sənəd hazırlıq planıdır. Oracle hesabı və server hələ yaradılmayıb.

## Server seçimi

- Oracle hesabının əsas regionunda Always Free uyğunluğu göstərilən resurs seçilməlidir.
- Mövcud pulsuz hesab limitləri daxilində Ubuntu 24.04, A1 Flex üçün 2 OCPU / 12 GB RAM və təxminən 50 GB başlanğıc disk nəzərdə tutulur. Hesabdakı digər resurslar da ümumi limitə daxildir.
- Konsoldakı ödəniş və limit göstəriciləri yaradılmadan əvvəl yoxlanmalıdır. Pullu hesaba keçid və pullu əlavə resurslar nəzərdə tutulmur.
- SSH girişi açarla, mümkün olduqda yalnız inzibatçının IP ünvanından olmalıdır. Müştəri trafiki üçün 80 və 443 portları açılır; 3000 internetə açılmır.

Rəsmi limitlər: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## Fayllar və məlumatlar

`scripts/prepare-oracle-release.mjs` Windows asılılıqları, `.env`, müştəri məlumatları və cihaz imzalama açarı daxil edilməyən ayrıca Linux yerləşdirmə arxivi hazırlayır. Arxivlə birlikdə SHA-256 yoxlama faylı yaradılır.

```powershell
node scripts/prepare-oracle-release.mjs C:/TAM_YOL/oracle-release
```

Yerli `npm ci`, TypeScript, API testləri və build bu paket hazırlanmazdan əvvəl tamamlanmalıdır. Paketə `package-lock.json` mütləq daxil edilir; serverdə Linux arxitekturasına uyğun asılılıqlar yalnız `npm ci` ilə həmin kiliddən quraşdırılır. Hazır paketdə inkişaf asılılıqları buraxılır.

Serverdə nəzərdə tutulan qovluqlar:

```text
/home/ubuntu/emgraphic/app/     tətbiq
/home/ubuntu/emgraphic/data/    daimi qeydiyyatlar və ehtiyat nüsxələri
```

Tətbiqin `.env` faylında `ADMIN_KEY`, `PORT=3000`, `HOST=127.0.0.1`, `TRUST_PROXY=loopback` və `DATA_DIR=/home/ubuntu/emgraphic/data` təyin edilir. Şifrə açıq komanda tarixçəsinə və ya arxivə yazılmamalıdır; faylın icazəsi 600 olmalıdır.

Hazırda yerli məlumat varsa, yalnız SSH bağlantısı yoxlandıqdan sonra ayrıca köçürülür. Mövcud server məlumatının üstünə avtomatik yazılmır. `data/.device-cookie-key` də qorunmalıdır ki, əvvəlki müştərilərin qeydiyyat sahibliyi itməsin. Məlumat qovluğuna yalnız tətbiqi işlədən istifadəçi daxil olmalıdır.

## Serverdə işə salma

Arxiv təhlükəsiz SSH bağlantısı ilə köçürülüb SHA-256 yoxlanıldıqdan, boş tətbiq qovluğuna açıldıqdan və `.env` hazırlandıqdan sonra:

```bash
cd /home/ubuntu/emgraphic/app
PREBUILT=1 bash deploy-vps.sh
```

Skript Node.js, PM2, Nginx və Certbot hazırlayır. PM2 bir Node prosesi işlədir, nasazlıq və sistem yenidən başladıqda tətbiqi bərpa edir. JSON məlumat saxlanmasına görə bir neçə paralel Node prosesi açılmamalıdır.

`nginx.conf.example` daxilində `SIZIN_DOMEN` həqiqi domen və ya subdomenlə əvəzlənir. Nginx yoxlanıb aktivləşdirilir, HTTPS sertifikatı alınır və yenilənmə sınağı aparılır. Domen/subdomen hələ müəyyən edilməyib; hazır HTTPS ünvanı yoxlanılmadan sayt müştərilərə təqdim edilmir.

Oracle şəbəkə qaydaları ilə Ubuntu firewall qaydaları ayrıca yoxlanır. Oracle-ın mövcud metadata, disk və SSH qaydaları silinmir; firewall tam sıfırlanmır.

## Son yoxlama

- Xarici HTTPS ünvanı, ana səhifə, admin girişi və API işləyir.
- Müştərinin yaratdığı və ləğv etdiyi sınaq qeydiyyatı admin paneldə avtomatik görünür.
- Vinetka saat aralığı həm admin, həm müştəri təqvimində eyni nəticə verir.
- 3000 portu kənardan bağlıdır, tətbiq yalnız 127.0.0.1 ünvanında dinləyir.
- Əsl müştəri IP-si proxy vasitəsilə düzgün müəyyən edilir.
- PM2 yenidən başlatma, ehtiyat nüsxəsi və sertifikat yenilənməsi yoxlanır.

Always Free resursları limitsiz deyil; tutum çatışmazlığı və fəaliyyətsiz instansiyanın Oracle tərəfindən geri alınması mümkündür. Ehtiyat nüsxəsinin serverdən kənarda da saxlanması vacibdir. Server daxilindəki gündəlik ehtiyat nüsxəsi təkbaşına server itkisindən qorumur.
