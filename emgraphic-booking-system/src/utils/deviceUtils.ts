/**
 * Device Identification & Anti-Abuse Fingerprinting Utilities
 * Ensures fair booking by preventing multiple active slots from the same device or browser.
 */

const STORAGE_DEVICE_KEY = '_emg_device_id';
const COOKIE_DEVICE_KEY = '_emg_did';
const isDeviceId = (value: string) => /^[a-zA-Z0-9_-]{16,128}$/.test(value);

/**
 * Returns or generates a persistent Device ID (stored in localStorage & cookie)
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_render';

  // 1. Check localStorage
  try {
    const localId = localStorage.getItem(STORAGE_DEVICE_KEY);
    if (localId && isDeviceId(localId)) {
      return localId;
    }
  } catch (e) {
    // localStorage might be blocked in restricted private mode
  }

  // 2. Check Cookie
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + COOKIE_DEVICE_KEY + '=([^;]*)'));
    if (match && match[2] && isDeviceId(decodeURIComponent(match[2]))) {
      const cookieId = decodeURIComponent(match[2]);
      try {
        localStorage.setItem(STORAGE_DEVICE_KEY, cookieId);
      } catch {}
      return cookieId;
    }
  } catch (e) {}

  // 3. Generate new persistent ID
  const newId = 'did_' + Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');

  try {
    localStorage.setItem(STORAGE_DEVICE_KEY, newId);
  } catch {}

  try {
    // Set 1 year persistent cookie
    document.cookie = `${COOKIE_DEVICE_KEY}=${encodeURIComponent(newId)}; Max-Age=31536000; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {}

  return newId;
}

/**
 * Generates a stable hardware/browser fingerprint hash
 * This is a heuristic only. It cannot prove identity or uniquely identify hardware.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server_render';

  try {
    const nav = window.navigator as any;
    const screen = window.screen;

    const components = [
      screen?.width || 0,
      screen?.height || 0,
      screen?.colorDepth || 0,
      window.devicePixelRatio || 1,
      nav?.language || '',
      Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || '',
      nav?.hardwareConcurrency || 1,
      nav?.platform || '',
      getCanvasHash(),
    ];

    const rawString = components.join('###');
    return `dfp_${hashString(rawString)}`;
  } catch (err) {
    return 'dfp_fallback';
  }
}

/**
 * Lightweight canvas fingerprint
 */
function getCanvasHash(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'nocanvas';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', sans-serif";
    ctx.fillStyle = '#f37021';
    ctx.fillRect(0, 0, 120, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Emgraphic-2026', 4, 8);

    return hashString(canvas.toDataURL());
  } catch {
    return 'canvase_err';
  }
}

/**
 * Simple fast 32-bit FNV-1a hash
 */
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}
