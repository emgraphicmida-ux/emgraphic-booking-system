/**
 * WhatsApp integration helpers for Emgraphic Studio
 */

export function cleanWhatsAppNumber(phone: string): string {
  if (!phone) return '994776079707';
  // Strip non-digits
  let digits = phone.replace(/\D/g, '');

  // Handle standard Azerbaijani prefixes:
  // e.g. 0776079707 -> 994776079707
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '994' + digits.slice(1);
  } else if (!digits.startsWith('994') && digits.length === 9) {
    digits = '994' + digits;
  }

  return digits || '994776079707';
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanWhatsAppNumber(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
