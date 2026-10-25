/**
 * Azerbaijan Phone Number Utilities
 * Format: +994 XX XXX XX XX (e.g. +994 50 123 45 67)
 * Digits only: exactly 9 digits after +994
 */

export const AZ_MOBILE_PREFIXES = [
  '10', '50', '51', '55', '60', '70', '77', '99',
  '12', '20', '21', '22', '23', '24', '25', '26'
];

// Accept only bounded Azerbaijani contact numbers. Prefixes include the landline
// ranges already supported by the studio; number ownership is a separate check.
export function parseAzPhone(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 32 || !/^\+?[\d ()-]+$/.test(raw.trim())) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('00994')) digits = digits.slice(5);
  else if (digits.length === 12 && digits.startsWith('994')) digits = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) && AZ_MOBILE_PREFIXES.includes(digits.slice(0, 2)) ? digits : '';
}

/**
 * Extracts clean digits (maximum 9) from user input.
 * Automatically strips country code "+994", leading "0", and any non-digit character.
 */
export function extractAzDigits(raw: string): string {
  if (!raw) return '';

  // Remove all non-digits
  let digits = raw.replace(/\D/g, '');

  // A partial/local 99 number beginning 994 is not a country code.
  if (digits.length === 14 && digits.startsWith('00994')) {
    digits = digits.slice(5);
  } else if ((digits.length === 12 || raw.trim().startsWith('+994')) && digits.startsWith('994')) {
    digits = digits.slice(3);
  }

  // If user pasted or typed 0 at the start (e.g. 050...), strip the leading 0
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Azerbaijan mobile numbers have exactly 9 digits
  return digits.slice(0, 9);
}

/**
 * Formats 9 digits as standard Azerbaijani phone number:
 * Example: "501234567" -> "50 123 45 67"
 */
export function formatAzLocalNumber(digits: string): string {
  if (!digits) return '';

  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/**
 * Returns full international format for storage and WhatsApp:
 * Example: "501234567" -> "+994 50 123 45 67"
 */
export function toAzInternationalFull(digits: string): string {
  if (!digits) return '';
  if (digits.length < 9) return `+994 ${digits}`;
  return `+994 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/**
 * Validates if the phone number has all 9 digits
 */
export function validateAzPhone(digits: string): { isValid: boolean; error?: string } {
  if (!digits || digits.length === 0) {
    return { isValid: false, error: 'Əlaqə nömrəsi daxil edilməlidir.' };
  }
  if (digits.length !== 9) {
    return {
      isValid: false,
      error: `Əlaqə nömrəsi 9 rəqəmli olmalıdır (hazırda: ${digits.length} rəqəm). Məsələn: 50 123 45 67`,
    };
  }

  if (!AZ_MOBILE_PREFIXES.includes(digits.slice(0, 2))) return { isValid: false, error: 'Düzgün Azərbaycan əlaqə nömrəsi daxil edin (məsələn, 50 123 45 67).' };
  return { isValid: true };
}
