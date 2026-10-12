import React from 'react';
import { Sparkles, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import heroStudioImg from '../assets/images/hero_emgraphic_studio_1790957471474.jpg';

interface HeroProps {
  onScrollToCalendar: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScrollToCalendar }) => {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/60 bg-gradient-to-b from-[#11131a] via-[#0b0c10] to-[#0b0c10] py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Column: Typography & Intent */}
          <div className="lg:col-span-7">
            <div className="mb-3.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c5a880]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Peşəkar Fotosessiya & Yaradıcı Studiya</span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-5xl/tight">
              Hər kadrda unikal <span className="text-[#c5a880] italic font-serif">estetika</span> və xatirələr
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Emgraphic Studio-nun canlı onlayn təqvimi ilə istədiyiniz tarixi və boş saatı dərhal seçin.
              Bütün saatlar real vaxt rejimində sinxronlaşır; dolu günlər və saatlar avtomatik kilidlənir.
            </p>

            {/* Value props list */}
            <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-zinc-300 sm:text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#c5a880]" />
                <span>09:00 - 20:00 Çəkiliş Saatları</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#c5a880]" />
                <span>Avtomatik Saat Kilidlənməsi</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#c5a880]" />
                <span>SMS və WhatsApp Təsdiqi</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={onScrollToCalendar}
                className="rounded-lg bg-gradient-to-r from-[#c5a880] to-[#ad8f66] px-6 py-3 text-sm font-bold text-[#0b0c10] shadow-lg shadow-[#c5a880]/15 transition-all hover:brightness-110 active:scale-[0.99]"
              >
                Təqvimə Keç və Saat Seç
              </button>
              <a
                href="#services"
                className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
              >
                Xidmət Qiymətləri
              </a>
            </div>
          </div>

          {/* Right Column: High-fidelity Studio Hero Image */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              <img
                src={heroStudioImg}
                alt="Emgraphic Studio - Professional Photo Studio Interior"
                className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-zinc-300 backdrop-blur-sm bg-black/40 p-3 rounded-xl border border-white/10">
                <div>
                  <p className="font-semibold text-white">Emgraphic Studio Flagship</p>
                  <p className="text-zinc-400">Nizami küçəsi 142, Bakı</p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Açıqdır
                  </span>
                  <p className="text-[11px] text-zinc-400 font-mono-num mt-0.5">09:00 - 20:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
