# Emgraphic Studio — çəkiliş qeydiyyatı

React 19, TypeScript, Vite 8, Tailwind CSS 4 və Express əsasında qurulub.

## İşə salmaq

Node.js 24 istifadə edin.

1. Bu qovluqda `npm install` icra edin.
2. `.env.example` faylını `.env` olaraq köçürün.
3. `.env` daxilində `ADMIN_KEY` üçün öz inzibatçı şifrənizi yazın.
4. İnkişaf üçün `npm run dev` icra edin: http://localhost:3000.

İstehsalat üçün `npm run build`, sonra `npm start` icra edin.
PM2 konfiqurasiyası yığılmış `server.js` faylından istifadə edir.

Hazır yerli nüsxəni açmaq üçün Windows-da `START-PREVIEW.cmd` faylını iki dəfə vurun
və ya `npm run preview:local` icra edin. Bu əmr mövcud serveri yoxlayır,
dayanıbsa onu ayrıca arxa fon prosesi kimi başladır və səhifə/API bağlantısını təsdiqləyir.
Başqa tətbiq eyni portu istifadə edirsə, onu dayandırmır.
Kompüter yenidən başladıqdan sonra bu faylı yenidən işə salın.

## Admin paneli

`/admin`, `/#admin` və `/?admin` ünvanları giriş ekranını açır.
Giriş şifrəsi yalnız serverdəki `ADMIN_KEY` dəyəridir.
Şifrə URL parametri ilə ötürülmür və server yoxlamadan panel açılmır.
Müştəri saytındakı loqoya üç dəfə vurmaq və ya Alt+A düymələri də giriş ekranını açır.

Müştəri və admin səhifələri eyni Express API-si və məlumat qovluğu ilə işləyir.
`/api/events` SSE axını dəyişiklik barədə şəxsi məlumat daşımayan bildiriş göndərir.
Müştəri bron yaradanda və ya ləğv edəndə admin siyahısı dərhal yenilənir.
Adminin etdiyi dəyişiklik də müştəri təqvimində avtomatik görünür.
Əlaqə kəsildikdə EventSource yenidən qoşulur; admin üçün 15, müştəri üçün 30 saniyəlik ehtiyat yenilənmə var.
Əl ilə bron, ləğvetmə, tamamlanma, bərpa və silmə server API-si ilə işləyir.
Əməliyyat uğursuz olduqda xəta göstərilir; uğur mesajı yalnız server təsdiqindən sonra çıxır.
Əl ilə bron üçün `POST /api/admin/bookings` istifadə olunur.
Eyni nömrə və ya eyni normallaşdırılmış ad üçün ikinci aktiv bron admin tərəfindən də yaradıla bilməz.
Adminin öz cihazına müştəri cihazı məhdudiyyəti tətbiq olunmur.
Eyni tarix və saatda iki aktiv bron qəbul edilmir.

## Təkrar qeydiyyat və təhlükəsizlik

Telefon nömrəsi bütün cihazlar üzrə yoxlanılır: +994, 0 və yerli formatlar eyni nömrə sayılır.
Adlarda böyük/kiçik hərf və artıq boşluqlar normallaşdırılır.
Eyni nömrə, ad və ya cihaz üçün yalnız bir `confirmed` / `checked_in` bron mümkündür.
Vaxtı keçmiş, amma nəticəsi qeyd edilməmiş aktiv bron da əvvəlcə ləğv edilməli və ya studiya tərəfindən nəticələndirilməlidir.
Tamamlanmış, ləğv edilmiş və gəlmədi kimi qeyd edilmiş bronlar yeni qeydiyyatı bloklamır.

Cihaz yoxlaması serverin imzaladığı HttpOnly/SameSite cookie-si və brauzerdə saxlanılan təsadüfi cihaz ID-si ilə edilir.
Cookie imzalama açarı `data/.device-cookie-key` faylında saxlanır; bu faylı məlumatlarla birlikdə qoruyun,
server yeniləməsində saxlayın və Git-ə göndərməyin. HTTPS-də cookie Secure olur.
Şəxsi bronun görünməsi və ləğvi üçün yalnız imzalı sahib cookie-si və ya bronun gizli açarı keçərlidir.
Təkcə telefon, açıq cihaz ID-si və brauzer fingerprint-i icazə vermir.

IP serverin bağlantısından götürülür və admin panelində görünür; müştəri/public API-lərinə çıxarılmır.
Bir IP-dən müxtəlif şəxslərin bron etməsi mümkündür.
Proxy olmayan quruluşda müştərinin göndərdiyi X-Forwarded-For nəzərə alınmır.
Yalnız yerli Nginx istifadə ediləndə `TRUST_PROXY=loopback` təyin edilir.

Cookie və cihaz məlumatları tam silinərsə və ya başqa brauzerdən istifadə edilərsə,
veb sayt fiziki cihazı qəti müəyyən edə bilməz. Telefon/ad limiti yenə serverdə qüvvədədir.
Telefon nömrəsinə sahiblik hazırda SMS/OTP ilə təsdiqlənmir.

## Saatlar və loqo

10:00-dan 20:00-dək hər 30 dəqiqədən bir 21 ayrıca seçim var.
20:00 son seçimdir. 10:00 və 10:30 müstəqil bron edilir.
Müştəri çəkilişə ən azı 30 dəqiqə öncədən yazılmalıdır. Məsələn, saat 14:00-da 14:30 seansını bron etmək mümkündür.
Bu qayda müştəri interfeysi və serverdə eyni mənbədən, saniyə dəqiqliyi ilə yoxlanılır.
Admin bu günə qısa müddət öncədən əl ilə bron əlavə edə bilər.

Rəsmi loqo: `src/assets/images/emgraphic-logo.jpg`.
Admin panelindən dəyişdirilən loqo serverdə saxlanır; sıfırlama bu rəsmi loqonu bərpa edir.

## Vinetka və studiyanın dolu saatları

Admin panelində **Saatları dolu qeyd et** bölməsini açın, tarix və səbəb seçin.
Başlanğıc və bitiş saatını seçin; bütün aralıq bir əməliyyatla bağlanır.
Məsələn, 12:00–16:00 üçün 12:00, 12:30, 13:00, 13:30, 14:00, 14:30, 15:00 və 15:30 dolu olur.
16:00-dan başlayan bronlar qəbul edilir. Son 20:00 seansını bağlamaq üçün bitiş 20:30 seçilir.
Aralıqda mövcud aktiv bron və ya əvvəl bağlanmış saat varsa, əməliyyat bütövlükdə dayandırılır.
Server də toqquşmanı yoxlayır: paralel sorğular bronu əvəz edə bilməz.
Bu saatlar ayrıca `data/studio-blocks.json` faylında saxlanır; müştəri bronları və statistikaya qarışmır.
Səbəb yalnız adminə görünür, müştəri təqvimində həmin saatlar dolu olur.
**Bu saatları aç** seçimi həmin qrupdakı vaxtları yenidən açır.
Bütün günlər işləkdir; həftəlik bağlı gün əlavə edilməyib.

**Vinetka qrupunun məlumatlarını əlavə et** seçimi ilə saat aralığına məktəb adı,
sinif, şagird sayı, məsul şəxsin adı və Azərbaycan əlaqə nömrəsini bağlamaq mümkündür.
Bu seçim açıldıqda beş xananın hamısı doldurulmalıdır; server də məlumatları yoxlayır.
Əvvəl yaradılmış aralığa da **Qrup məlumatlarını əlavə et** ilə məlumat əlavə etmək olar.
**Qrup məlumatlarını dəyiş** saatları açmadan və bronları dəyişmədən məlumatları yeniləyir.
Başqa admin həmin qeydi dəyişibsə, köhnə redaktə yenisini əvəz etmir.
Qrup məlumatları yalnız adminə görünür, public API və canlı bildirişlərdə paylaşılmır.
Məlumatlar `studio-blocks.json` daxilində saxlanır və ehtiyat nüsxələrə daxil edilir.
Vinetka aralığının saatları açılanda qrup məlumatları silinmir, `releasedAt` ilə saxlanır;
müştərilər həmin vaxtları yenidən bron edə bilər. Əvvəlki günün qruplarına baxmaq üçün tarix seçicisindən istifadə edin.

## Ehtiyat nüsxələr

Server açıldıqda və hər dəqiqə Bakı təqviminə görə gündəlik nüsxə yoxlanılır.
Hər gün bir avtomatik nüsxə yaradılır. Server sönülü ikən nüsxə yaradılmır;
növbəti işə salmada həmin günün nüsxəsi hazırlanır. Günün ilk yazısından əvvəl də yoxlanılır.
Əl ilə nüsxə yaratmaq, yükləmək və mövcud server nüsxəsini bərpa etmək admin panelindən mümkündür.
Bronu tam silmədən və bütün məlumatları bərpa etmədən əvvəl ayrıca təhlükəsizlik nüsxəsi yaradılır.
Nüsxələrdə bronlar, studiyanın dolu saatları, əlaqə məlumatları və xüsusi loqo saxlanır.
Nüsxələr `data/backups/` daxilindədir; Git və paylanılan ZIP-ə daxil edilmir.
Mövcud yerli nüsxələrin bütövlüyü serverin gizli açarı ilə yoxlanılır.
Bərpa zamanı indiki vəziyyət əvvəlcə qorunur; yarımçıq bərpa jurnalı növbəti açılışda tamamlanır.
Bərpa köhnə vəziyyəti bütövlükdə qaytarır; sonrakı bronları birləşdirmir.
Ekranda açıq xəbərdarlıq və `BƏRPA ET` yazılı təsdiqi tələb edilir.

Nüsxələr bu kompüterdədir. Disk nasazlığından qorunmaq üçün **Yüklə** ilə başqa diskdə saxlayın.
İxrac faylı şəxsi bron açarlarını və cihaz cookie-si imzalama açarını da daşıyır; məxfi saxlanmalıdır.
Yeni serverə fövqəladə köçürmə zamanı server dayandırılmalı, ixracın `snapshot.files` xəritəsindəki
dörd fayl `DATA_DIR` daxilinə yazılmalı (`null` loqo ayrıca faylın olmamasıdır),
`deviceCookieKey` isə `DATA_DIR/.device-cookie-key` kimi saxlanmalıdır.
Əvvəlcə cari məlumat qovluğunun ayrıca nüsxəsini götürün. Admin şifrəsi ixrac edilmir;
yeni serverdə ayrıca `ADMIN_KEY` təyin edilir. Diskdəki nüsxələr avtomatik silinmir.

## Məlumatların saxlanması

Bronlar `data/bookings.json`, studiya tənzimləmələri `data/settings.json`,
xüsusi loqo isə `data/logo.json` daxilində saxlanır.
`DATA_DIR` mühit dəyişəni ilə başqa daimi qovluq seçmək olar.
Yeniləmə zamanı bu məlumat fayllarını saxlayın.

## Aylıq statistika

Admin panelində ay seçilir və iki göstərici görünür: **Çəkiliş oldu**, **Ləğv olundu**.
Ay müraciətin yaradıldığı tarixə yox, planlaşdırılmış çəkiliş tarixinə görə hesablanır.
Çəkiliş sayı müddəti bitmiş və ləğv edilməmiş bronlara əsaslanır; gələcək bronlar sayılmır.
Əvvəldən “gəlmədi” qeyd edilmiş köhnə bronlar çəkiliş sayına daxil edilmir.
Ləğvlərə həm müştəri, həm admin tərəfindən ləğv edilən bronlar daxildir.
İstənilən keçmiş ayı seçib əvvəlki nəticələrə baxmaq mümkündür.

Paneldə status mərhələləri, gəliş və tamamlanma təsdiqləri yoxdur.
Server vaxtı bitmiş aktiv bronları hər 15 saniyədən bir və oxunuşlarda arxa planda bağlayır;
bunun üçün işçilərin təsdiqi tələb edilmir. Açıq paneldə aylıq saylar da vaxtla yenilənir.
Müştərinin faktiki iştirakını avtomatik müəyyən etmir; rəqəm planlaşdırılmış seansa əsaslanır.
Qeydiyyatın tam silinməsi aylıq saylara da təsir edir və silmə pəncərəsində izah olunur.

Müştəri bronunu çəkiliş başlayana qədər özü ləğv edə bilər; 2 saatlıq ləğvetmə məhdudiyyəti yoxdur.
Başlanğıcdan sonrakı sorğular serverdə rədd edilir. Admin panelindən studiya ləğvetməsi mümkündür.

Paralel əməliyyatlarda köhnə admin ekranının müştərinin yeni ləğvetməsini
əvəz etməsinin qarşısını almaq üçün `expectedStatus` yoxlanılır.

## Yoxlama

`npm run lint` — TypeScript yoxlaması.
`npm run build` — istifadəçi interfeysi və serverin yığılması.
`npm run test:api` — server, qeydiyyat müddəti, aylıq statistika, ləğvetmə, təhlükəsizlik, vinetka qrupları, studiya saatları və ehtiyat nüsxələr üzrə 53 sınaq.

API sınaqları müvəqqəti məlumat qovluğundan istifadə edir.
Mövcud studiya qeydiyyatlarına toxunmur.
