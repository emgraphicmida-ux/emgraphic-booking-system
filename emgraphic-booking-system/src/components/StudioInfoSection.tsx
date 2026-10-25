import React from 'react';
import { Camera, MapPin, Phone, Mail, Clock, Award, Shield, Heart } from 'lucide-react';
import portraitImg from '../assets/images/studio_portrait_session_1790957486731.jpg';
import { PHOTOSHOOT_CATEGORIES } from '../types/booking';

export const StudioInfoSection: React.FC = () => {
  return (
    <div className="space-y-16 py-12">
      {/* Photoshoot Services Showcase */}
      <section id="services" className="scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs uppercase tracking-widest text-[#c5a880] font-semibold">
            Xidmətlər və Paketlər
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-1">
            İxtisaslaşdığımız Çəkiliş Növləri
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Hər bir janr üçün xüsusi işıqlandırma sxemi, arxa fonlar və peşəkar komanda təqdim edirik.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PHOTOSHOOT_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="group rounded-2xl border border-zinc-800 bg-[#12141c]/80 p-5 hover:border-[#c5a880]/50 transition-all duration-300 hover:shadow-xl hover:shadow-[#c5a880]/5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <h3 className="font-display text-base font-bold text-white group-hover:text-[#c5a880] transition-colors">
                  {cat.title}
                </h3>
                <span className="font-mono-num text-xs font-bold text-[#c5a880] bg-[#c5a880]/15 px-2 py-0.5 rounded">
                  {cat.price}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                {cat.description}
              </p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500 pt-3 border-t border-zinc-850">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  {cat.duration}
                </span>
                <span>Təqvimdə 09:00 - 20:00</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About the Studio & Visual Atmosphere */}
      <section id="about" className="scroll-mt-20 overflow-hidden rounded-3xl border border-zinc-800 bg-[#12141c]/90 p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs uppercase tracking-widest text-[#c5a880] font-semibold">
              Haqqımızda
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Emgraphic Studio · Peşəkar Foto-İncəsənət Məkanı
            </h2>
            <p className="text-sm leading-relaxed text-zinc-300">
              Bakının mərkəzində yerləşən Emgraphic Studio, müasir işıq avadanlıqları (Profoto, Godox, Aputure), geniş tsiklorama və müxtəlif interyer guşələri ilə təchiz olunmuşdur.
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              Biz hər bir çəkilişə fərdi yanaşır, rahat mühit yaradır və ən təbii, cəlbedici kadrları əbədiləşdiririk. Onlayn bron sistemimiz vasitəsilə növbə gözləmədən sizə ən uyğun saatı bir toxunuşla rezerv edə bilərsiniz.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <Award className="h-4 w-4 text-[#c5a880]" />
                <span>8+ İl Peşəkar Təcrübə</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Shield className="h-4 w-4 text-[#c5a880]" />
                <span>Dəqiq Saat Təminatı</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
              <img
                src={portraitImg}
                alt="Emgraphic Studio - Artistic Portrait Session"
                className="aspect-[4/3] w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 text-xs text-white">
                <p className="font-semibold">Portret və Editorial Çəkilişlər</p>
                <p className="text-zinc-400 text-[11px]">Yüksək detallı rəng korreksiyası və retuş</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location & Contacts Footer */}
      <section className="rounded-2xl border border-zinc-800 bg-[#0d0f15] p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-400">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 text-[#c5a880] border border-zinc-800">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">Studiya Ünvanı</p>
              <p>Bakı şəhəri, Nizami küçəsi 142</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">(Fəvvarələr meydanının yaxınlığı)</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 text-[#c5a880] border border-zinc-800">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">İş Saatları</p>
              <p className="font-mono-num text-zinc-300">Hər gün: 09:00 - 20:00</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Yalnız onlayn qeydiyyatla</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 text-[#c5a880] border border-zinc-800">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">Əlaqə & WhatsApp</p>
              <p className="font-mono-num text-zinc-300">+994 50 234 56 78</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">info@emgraphicstudio.az</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} Emgraphic Studio. Bütün hüquqlar qorunur.</p>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>09:00 - 20:00 Onlayn Təqvim</span>
            <span>·</span>
            <span>Real-vaxt Rezervasiya</span>
          </div>
        </div>
      </section>
    </div>
  );
};
