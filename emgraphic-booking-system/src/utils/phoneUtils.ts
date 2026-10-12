/**
 * Azerbaijan Phone Number Utilities
 * Format: +994 XX XXX XX XX (e.g. +994 50 123 45 67)
 * Digits only: exactly 9 digits after +994
 */

export const AZ_MOBILE_PREFIXES = [
  '10', '50', '51', '55', '60', '70', '77', '99',
  '12', '20', '21', '22', '23', '24', '25', '26'
];

/**
 * Extracts clean digits (maximum 9) from user input.
 * Automatically strips country code "+994", leading "0", and any non-digit character.
 */
export function extractAzDigits(raw: string): string {
  if (!raw) return '';

  // Remove all non-digits
  let digits = raw.replace(/\D/g, '');

  // If starts with 994, strip it
  if (digits.startsWith('994')) {
    digits = digits.slice(3);
  }

  // If user pasted or typed 0 at the start (e.g. 050...), strip the leading 0
  if (digits.startsWith('0')) {
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
  if (digits.length < 9) {
    return {
      isValid: false,
      error: `Əlaqə nömrəsi 9 rəqəmli olmalıdır (hazırda: ${digits.length} rəqəm). Məsələn: 50 123 45 67`,
    };
  }

  return { isValid: true };
}
