import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { apiService } from '../services/apiService';
import { buildWhatsAppLink } from '../utils/whatsappUtils';

interface WhatsAppFloatingButtonProps {
  whatsappNumber?: string;
}

export const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({
  whatsappNumber: propNumber,
}) => {
  const [phone, setPhone] = useState<string>(propNumber || '+994 77 607 97 07');

  useEffect(() => {
    if (propNumber) {
      setPhone(propNumber);
      return;
    }
    let isMounted = true;
    apiService.getSettings().then((settings) => {
      if (isMounted && settings?.whatsappNumber) {
        setPhone(settings.whatsappNumber);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [propNumber]);

  const defaultMsg = 'Salam Emgraphic Studio! Çəkiliş qeydiyyatı ilə bağlı sualım var.';
  const waUrl = buildWhatsAppLink(phone, defaultMsg);

  return (
    <aside
      aria-label="WhatsApp Canlı Dəstək"
      className="fixed bottom-8 sm:bottom-10 right-4 sm:right-6 z-40 flex items-center group print:hidden select-none"
    >
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white py-2.5 px-3.5 sm:px-4 shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        title="WhatsApp ilə canlı əlaqə saxlayın"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <MessageCircle className="h-5 w-5 fill-white stroke-[#25D366]" />
        </span>
        <span className="text-xs sm:text-sm font-bold tracking-wide">
          WhatsApp
        </span>
      </a>
    </aside>
  );
};
