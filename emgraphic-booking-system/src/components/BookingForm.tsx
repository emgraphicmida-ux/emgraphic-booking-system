import React, { useState } from 'react';
import { User, Phone, FileText, AlertCircle, ArrowRight, Clock, Calendar } from 'lucide-react';
import { PhotoshootType, PHOTOSHOOT_CATEGORIES } from '../types/booking';
import {
  extractAzDigits,
  formatAzLocalNumber,
  toAzInternationalFull,
  validateAzPhone,
} from '../utils/phoneUtils';

interface BookingFormProps {
  selectedDate: string;
  selectedSlot: string | null;
  onSubmit: (formData: {
    clientName: string;
    clientPhone: string;
    photoshootType: PhotoshootType;
    notes?: string;
  }) => void;
  isSubmitting?: boolean;
  serverError?: string | null;
  onOpenCancelModal?: () => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  selectedDate,
  selectedSlot,
  onSubmit,
  isSubmitting = false,
  serverError = null,
  onOpenCancelModal,
}) => {
  const [clientName, setClientName] = useState('');
  // raw 9 digits of Azerbaijan phone number (e.g. "501234567")
  const [phoneDigits, setPhoneDigits] = useState('');
  const [photoshootType, setPhotoshootType] = useState<PhotoshootType>('1 dekor (20-25 kadr fotoşəkil)');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSlot) {
      setError('Zəhmət olmasa təqvimdən boş bir saat seçin.');
      return;
    }

    if (!clientName.trim() || clientName.trim().length < 3) {
      setError('Zəhmət olmasa Ad və Soyadınızı daxil edin.');
      return;
    }

    // Validate Azerbaijan phone number
    const phoneValidation = validateAzPhone(phoneDigits);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || 'Düzgün Azərbaycan mobil nömrəsi daxil edin.');
      return;
    }

    const fullPhone = toAzInternationalFull(phoneDigits);

    onSubmit({
      clientName: clientName.trim(),
      clientPhone: fullPhone,
      photoshootType,
      notes: notes.trim(),
    });
  };

  // Handle phone changes and paste events: automatically strips any letter or non-digit
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanDigits = extractAzDigits(rawVal);
    setPhoneDigits(cleanDigits);
    if (error && error.includes('nömrə')) {
      setError(null);
    }
  };

  const formattedPhone = formatAzLocalNumber(phoneDigits);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 md:p-6 shadow-xs lg:sticky lg:top-24">
      {/* Title */}
      <div className="pb-3.5 border-b border-slate-100">
        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <User className="h-4 w-4 text-[#F37021]" />
          Yazmaq üçün Bölmə
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Məlumatları yazaraq qeydiyyatı tamamlayın
        </p>
      </div>

      {/* Selected Date & Time slot recap */}
      <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs sm:text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <Calendar className="h-4 w-4 text-[#F37021]" />
            Tarix:
          </span>
          <span className="font-mono-num font-bold text-slate-900">{selectedDate}</span>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <Clock className="h-4 w-4 text-[#F37021]" />
            Seçilmiş saat:
          </span>
          {selectedSlot ? (
            <span className="font-mono-num font-black text-slate-900 bg-white border border-slate-300 px-2.5 py-0.5 rounded-lg text-sm sm:text-base shadow-2xs">
              {selectedSlot} <span className="text-xs text-slate-500 font-semibold">(30 dəq)</span>
            </span>
          ) : (
            <span className="text-[#F37021] text-xs font-bold">
              ← Əvvəlcə saat seçin
            </span>
          )}
        </div>
      </div>

      {(error || serverError) && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span className="leading-relaxed font-medium">{error || serverError}</span>
          </div>
          {((error?.includes('ləğv') || serverError?.includes('ləğv') || serverError?.includes('aktiv')) && onOpenCancelModal) && (
            <div className="pt-2 border-t border-red-200/60 flex justify-end">
              <button
                type="button"
                onClick={onOpenCancelModal}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-2xs"
              >
                Mövcud Qeydiyyatı Ləğv Et
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {/* Name Input */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
            Ad və Soyad <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Məs: Leyla Əliyeva"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 px-3.5 pl-10 text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none"
            />
            <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Phone Input */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
            Əlaqə Nömrəsi <span className="text-red-500">*</span>
          </label>

          <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-slate-800 transition-colors overflow-hidden">
            {/* Country Flag & Fixed +994 Prefix */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3.5 py-3 border-r border-slate-200 select-none shrink-0">
              <span className="text-base leading-none" role="img" aria-label="Bayraq">
                🇦🇿
              </span>
              <span className="text-sm sm:text-base font-bold font-mono text-slate-800">
                +994
              </span>
            </div>

            {/* Digits only input */}
            <div className="relative flex-1">
              <input
                type="tel"
                inputMode="numeric"
                required
                value={formattedPhone}
                onChange={handlePhoneChange}
                placeholder="50 123 45 67"
                maxLength={14}
                className="w-full py-3 px-3.5 text-sm sm:text-base font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Photoshoot Type */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
            Çəkilişin Növü <span className="text-red-500">*</span>
          </label>
          <select
            value={photoshootType}
            onChange={(e) => setPhotoshootType(e.target.value as any)}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 px-3.5 text-sm sm:text-base font-medium text-slate-900 focus:border-slate-800 focus:outline-none"
          >
            <optgroup label="Standart Dekor Paketləri">
              {PHOTOSHOOT_CATEGORIES.filter((c) => c.group === 'Standart Dekor').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Albomlu Paketlər">
              {PHOTOSHOOT_CATEGORIES.filter((c) => c.group === 'Albomlu').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Videolu Paketlər">
              {PHOTOSHOOT_CATEGORIES.filter((c) => c.group === 'Videolu').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Selected package explanation */}
          {(() => {
            const currentCat = PHOTOSHOOT_CATEGORIES.find((c) => c.id === photoshootType);
            if (!currentCat) return null;
            return (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 text-xs sm:text-sm text-orange-950">
                <span className="font-medium text-xs sm:text-sm">{currentCat.description}</span>
                <span className="font-extrabold text-[#F37021] text-xs sm:text-sm shrink-0 ml-2">{currentCat.price}</span>
              </div>
            );
          })()}
        </div>

        {/* Notes Input */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
            Əlavə Qeyd
          </label>
          <div className="relative">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="İstəkləriniz, geyim sayı..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none resize-none"
            />
            <FileText className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !selectedSlot}
          className={`w-full min-h-[52px] rounded-xl py-3.5 px-5 text-base sm:text-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            selectedSlot
              ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
        >
          <span>
            {isSubmitting
              ? 'Qeydiyyat aparılır...'
              : selectedSlot
              ? 'Qeydiyyatı Tamamla'
              : 'Əvvəlcə Saat Seçin'}
          </span>
          <ArrowRight className="h-5 w-5" />
        </button>

        {/* Studio Location Google Maps Link */}
        <div className="pt-2 text-center">
          <a
            href="https://maps.app.goo.gl/uKw9CnAKpEGXVrGm8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#F37021] transition-colors"
          >
            <span>📍 Studiya Ünvanı: Hövsan, MİDA 1, Bina 1</span>
            <span className="text-[#F37021] underline underline-offset-2 font-bold">(Xəritədə bax ↗)</span>
          </a>
        </div>
      </form>
    </div>
  );
};
