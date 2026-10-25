/**
 * WhatsApp integration helpers for Emgraphic Studio
 */
import { parseAzPhone } from './phoneUtils.js';

export function cleanWhatsAppNumber(phone: string): string {
  if (!phone) return '994776079707';
  const digits = parseAzPhone(phone);
  return digits ? '994' + digits : '';
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanWhatsAppNumber(phone);
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}` : '#';
}
