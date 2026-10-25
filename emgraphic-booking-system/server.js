// server.ts
import "dotenv/config";
import express from "express";
import { randomUUID as randomUUID2, randomBytes as randomBytes3 } from "node:crypto";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";

// src/types/booking.ts
var ALL_TIME_SLOTS = [
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00"
];
function normalizeTimeSlot(slot) {
  if (!slot) return "";
  const s = String(slot).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = match[1].padStart(2, "0");
    const minutes = match[2];
    return `${hours}:${minutes}`;
  }
  return s;
}
function isSameOrMatchingSlot(slotA, slotB) {
  if (!slotA || !slotB) return false;
  if (slotA === slotB) return true;
  return normalizeTimeSlot(slotA) === normalizeTimeSlot(slotB);
}
var PHOTOSHOOT_CATEGORIES = [
  // Standart Dekor
  {
    id: "1 dekor (20-25 kadr foto\u015F\u0259kil)",
    title: "1 dekor: 20 AZN (20-25 kadr foto\u015F\u0259kil)",
    duration: "30 d\u0259qiq\u0259",
    price: "20 AZN",
    description: "1 dekorasiyada \xE7\u0259kili\u015F, 20-25 kadr foto\u015F\u0259kil.",
    group: "Standart Dekor"
  },
  {
    id: "2 dekor (30-35 kadr foto\u015F\u0259kil)",
    title: "2 dekor: 30 AZN (30-35 kadr foto\u015F\u0259kil)",
    duration: "30 d\u0259qiq\u0259",
    price: "30 AZN",
    description: "2 dekorasiyada \xE7\u0259kili\u015F, 30-35 kadr foto\u015F\u0259kil.",
    group: "Standart Dekor"
  },
  {
    id: "3 dekor (40-45 kadr foto\u015F\u0259kil)",
    title: "3 dekor: 35 AZN (40-45 kadr foto\u015F\u0259kil)",
    duration: "30 d\u0259qiq\u0259",
    price: "35 AZN",
    description: "3 dekorasiyada \xE7\u0259kili\u015F, 40-45 kadr foto\u015F\u0259kil.",
    group: "Standart Dekor"
  },
  {
    id: "4 dekor (50-55 kadr foto\u015F\u0259kil)",
    title: "4 dekor: 45 AZN (50-55 kadr foto\u015F\u0259kil)",
    duration: "30 d\u0259qiq\u0259",
    price: "45 AZN",
    description: "4 dekorasiyada \xE7\u0259kili\u015F, 50-55 kadr foto\u015F\u0259kil.",
    group: "Standart Dekor"
  },
  // Albomlu
  {
    id: "1 dekor + albom",
    title: "1 dekor + albom: 45 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "45 AZN",
    description: "1 dekor fotosessiyas\u0131 v\u0259 x\xFCsusi dizaynl\u0131 fotoalbom.",
    group: "Albomlu"
  },
  {
    id: "2 dekor + albom",
    title: "2 dekor + albom: 55 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "55 AZN",
    description: "2 dekor fotosessiyas\u0131 v\u0259 x\xFCsusi dizaynl\u0131 fotoalbom.",
    group: "Albomlu"
  },
  {
    id: "3 dekor + albom",
    title: "3 dekor + albom: 60 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "60 AZN",
    description: "3 dekor fotosessiyas\u0131 v\u0259 x\xFCsusi dizaynl\u0131 fotoalbom.",
    group: "Albomlu"
  },
  {
    id: "4 dekor + albom",
    title: "4 dekor + albom: 70 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "70 AZN",
    description: "4 dekor fotosessiyas\u0131 v\u0259 x\xFCsusi dizaynl\u0131 fotoalbom.",
    group: "Albomlu"
  },
  // Videolu
  {
    id: "1 dekor + video",
    title: "1 dekor + video: 40 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "40 AZN",
    description: "1 dekor fotosessiyas\u0131 v\u0259 estetik video\xE7arx / reels \xE7\u0259kili\u015Fi.",
    group: "Videolu"
  },
  {
    id: "2 dekor + video",
    title: "2 dekor + video: 50 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "50 AZN",
    description: "2 dekor fotosessiyas\u0131 v\u0259 estetik video\xE7arx / reels \xE7\u0259kili\u015Fi.",
    group: "Videolu"
  },
  {
    id: "3 dekor + video",
    title: "3 dekor + video: 65 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "65 AZN",
    description: "3 dekor fotosessiyas\u0131 v\u0259 estetik video\xE7arx / reels \xE7\u0259kili\u015Fi.",
    group: "Videolu"
  },
  {
    id: "4 dekor + video",
    title: "4 dekor + video: 70 AZN",
    duration: "30 d\u0259qiq\u0259",
    price: "70 AZN",
    description: "4 dekor fotosessiyas\u0131 v\u0259 estetik video\xE7arx / reels \xE7\u0259kili\u015Fi.",
    group: "Videolu"
  },
  {
    id: "T\u0259k Video (fotosessiyas\u0131z)",
    title: "T\u0259k Video (fotosessiyas\u0131z): 30 AZN-d\u0259n",
    duration: "30 d\u0259qiq\u0259",
    price: "30 AZN-d\u0259n",
    description: "Fotosessiyas\u0131z, ayr\u0131ca video\xE7arx v\u0259 ya reels \xE7\u0259kili\u015Fi.",
    group: "Videolu"
  }
];

// src/utils/attendance.ts
var SESSION_MINUTES = 30;
function bookingStartsAt(booking) {
  const slot = booking.timeSlot.match(/^(\d{1,2}):(\d{2})/);
  if (!slot) return NaN;
  return Date.parse(booking.date + "T" + slot[1].padStart(2, "0") + ":" + slot[2] + ":00+04:00");
}
function bookingEndsAt(booking) {
  return bookingStartsAt(booking) + SESSION_MINUTES * 6e4;
}
function isActiveBooking(booking) {
  return booking.status === "confirmed" || booking.status === "checked_in";
}
function finishElapsedBookings(bookings, now = Date.now()) {
  let changed = false;
  for (const booking of bookings) {
    if (isActiveBooking(booking) && bookingEndsAt(booking) <= now) {
      booking.status = "completed";
      booking.completedAt = new Date(bookingEndsAt(booking)).toISOString();
      booking.completionSource = "automatic";
      changed = true;
    }
  }
  return changed;
}

// server/identity.ts
import { createHash as createHash2, createHmac, randomBytes as randomBytes2, timingSafeEqual } from "node:crypto";

// src/utils/phoneUtils.ts
var AZ_MOBILE_PREFIXES = [
  "10",
  "50",
  "51",
  "55",
  "60",
  "70",
  "77",
  "99",
  "12",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26"
];
function parseAzPhone(raw) {
  if (typeof raw !== "string" || raw.length > 32 || !/^\+?[\d ()-]+$/.test(raw.trim())) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 14 && digits.startsWith("00994")) digits = digits.slice(5);
  else if (digits.length === 12 && digits.startsWith("994")) digits = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) && AZ_MOBILE_PREFIXES.includes(digits.slice(0, 2)) ? digits : "";
}
function toAzInternationalFull(digits) {
  if (!digits) return "";
  if (digits.length < 9) return `+994 ${digits}`;
  return `+994 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

// server/legacySecrets.ts
import { createHash, randomBytes } from "node:crypto";
var REVOKED_CLIENT_SECRET_HASHES = /* @__PURE__ */ new Set(["960b1833069c19eea35e1d13292deaf7941c047f6b56123fa622b0c98f704854", "124d6bfa2b0bf368f7293e5da3fef61b33409c4ff556a179ef4d36484a372016", "ca4798ff35f70379fe7c1fe8759c381df5dd9b5b82adb2db99750d5b9fc08bf1", "07485b4a88027b6c8f61be46e10cb3611b169abc02f57c05a39d2a72fd767d99"]);
function isRevokedClientSecret(value, hashes = REVOKED_CLIENT_SECRET_HASHES) {
  return typeof value === "string" && hashes.has(createHash("sha256").update(value).digest("hex"));
}
function rotateExposedBookingSecrets(bookings, hashes = REVOKED_CLIENT_SECRET_HASHES) {
  let changed = false;
  for (const booking of bookings) {
    if (isRevokedClientSecret(booking.clientSecret, hashes)) {
      booking.clientSecret = randomBytes(32).toString("hex");
      changed = true;
    }
  }
  return changed;
}

// server/identity.ts
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
function normalizePhone(raw) {
  return parseAzPhone(raw);
}
function normalizeName(raw) {
  return typeof raw === "string" ? raw.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("az-AZ") : "";
}
function cleanDeviceId(raw) {
  return typeof raw === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(raw) ? raw : void 0;
}
function cleanTokens(raw) {
  return Array.isArray(raw) ? raw.filter((t) => typeof t === "string" && t.length >= 16 && t.length <= 128 && !isRevokedClientSecret(t)).slice(-100) : [];
}
var cookieName = "_emg_verified_device";
function visitorDevice(req, res, secret) {
  const raw = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
  const parts = raw.match(/^([a-f0-9]{64})\.([a-f0-9]{64})$/);
  const sign = (token2) => createHmac("sha256", secret).update(token2).digest("hex");
  let token = parts && sameSecret(parts[2], sign(parts[1])) ? parts[1] : "";
  const issueCookie = !token || req.secure;
  if (!token) token = randomBytes2(32).toString("hex");
  if (issueCookie) {
    res.cookie(cookieName, token + "." + sign(token), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      path: "/",
      maxAge: 365 * 24 * 60 * 60 * 1e3
    });
  }
  return createHash2("sha256").update(token).digest("hex");
}
function ownsBooking(booking, deviceHash, tokens) {
  return !!(booking.deviceTokenHash && sameSecret(booking.deviceTokenHash, deviceHash)) || !!(booking.clientSecret && !isRevokedClientSecret(booking.clientSecret) && tokens.some((token) => sameSecret(token, booking.clientSecret)));
}
function findActiveDuplicate(bookings, identity, exceptId) {
  const phone = normalizePhone(identity.clientPhone);
  const name = normalizeName(identity.clientName);
  return bookings.find((booking) => booking.id !== exceptId && isActiveBooking(booking) && (!!phone && normalizePhone(booking.clientPhone) === phone || !!name && normalizeName(booking.clientName) === name || !!identity.deviceId && booking.deviceId === identity.deviceId || !!identity.deviceTokenHash && booking.deviceTokenHash === identity.deviceTokenHash || !!(booking.clientSecret && identity.tokens?.some((token) => sameSecret(token, booking.clientSecret)))));
}
function publicBooking(booking, withSecret = false) {
  const { clientSecret, clientIp, deviceId, deviceFingerprint, deviceTokenHash, ...safe } = booking;
  return withSecret ? { ...safe, clientSecret } : safe;
}

// server/studio.ts
import fs from "node:fs";
import path from "node:path";
import { createHmac as createHmac2, randomUUID, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
function validStudioDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function readStudioBlocks(directory) {
  const data = JSON.parse(fs.readFileSync(path.join(directory, "studio-blocks.json"), "utf8"));
  if (!Array.isArray(data) || data.some((b) => !b || typeof b.id !== "string" || !validStudioDate(b.date) || !Array.isArray(b.timeSlots) || !b.timeSlots.length || b.timeSlots.some((s) => !ALL_TIME_SLOTS.includes(s)) || typeof b.reason !== "string")) throw new Error("Studiya saatlar\u0131 fayl\u0131 d\xFCzg\xFCn deyil.");
  return data;
}
var files = ["bookings.json", "settings.json", "studio-blocks.json", "logo.json"];
var StudioBackups = class {
  constructor(directory, signingKey, notify) {
    this.directory = directory;
    this.signingKey = signingKey;
    this.notify = notify;
    this.dailyDay = "";
    this.folder = path.join(directory, "backups");
    this.journal = path.join(directory, ".restore-pending.json");
    fs.mkdirSync(this.folder, { recursive: true, mode: 448 });
    if (process.platform !== "win32") fs.chmodSync(this.folder, 448);
    if (fs.existsSync(this.journal)) {
      const snapshot = this.verify(fs.readFileSync(this.journal, "utf8"));
      this.apply(snapshot);
      fs.unlinkSync(this.journal);
    }
  }
  atomic(file, text) {
    const temporary = file + "." + randomUUID() + ".tmp";
    try {
      fs.writeFileSync(temporary, text, { mode: 384, flag: "wx", flush: true });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  seal(snapshot) {
    const payload = JSON.stringify(snapshot);
    return JSON.stringify({ payload, signature: createHmac2("sha256", this.signingKey).update(payload).digest("hex") });
  }
  verify(raw) {
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== "string" || typeof envelope.signature !== "string" || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw new Error("Ehtiyat n\xFCsx\u0259 z\u0259d\u0259l\u0259nib.");
    const expected = createHmac2("sha256", this.signingKey).update(envelope.payload).digest();
    if (!timingSafeEqual2(expected, Buffer.from(envelope.signature, "hex"))) throw new Error("Ehtiyat n\xFCsx\u0259nin b\xFCt\xF6vl\xFCy\xFC t\u0259sdiql\u0259nm\u0259di.");
    const snapshot = JSON.parse(envelope.payload);
    if (snapshot.version !== 1 || !snapshot.files || !Array.isArray(JSON.parse(snapshot.files["bookings.json"])) || !Array.isArray(JSON.parse(snapshot.files["studio-blocks.json"]))) throw new Error("Ehtiyat n\xFCsx\u0259nin format\u0131 d\xFCzg\xFCn deyil.");
    for (const file of files) {
      const content = snapshot.files[file];
      if (content === null && file === "logo.json") continue;
      if (typeof content !== "string") throw new Error("Ehtiyat n\xFCsx\u0259 natamamd\u0131r.");
      JSON.parse(content);
    }
    return snapshot;
  }
  fileFor(id) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new Error("N\xFCsx\u0259 tap\u0131lmad\u0131.");
    return path.join(this.folder, id + ".json");
  }
  metadata(s) {
    return { id: s.id, createdAt: s.createdAt, kind: s.kind, day: s.day, bookingCount: JSON.parse(s.files["bookings.json"]).length, blockCount: JSON.parse(s.files["studio-blocks.json"]).length };
  }
  list() {
    return fs.readdirSync(this.folder).filter((f) => /^[a-f0-9-]{36}\.json$/.test(f)).map((file) => {
      try {
        return this.metadata(this.verify(fs.readFileSync(path.join(this.folder, file), "utf8")));
      } catch {
        return null;
      }
    }).filter((s) => s !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  create(kind = "manual") {
    const snapshot = { version: 1, id: randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), day: this.today(), kind, files: {} };
    for (const file of files) snapshot.files[file] = fs.existsSync(path.join(this.directory, file)) ? fs.readFileSync(path.join(this.directory, file), "utf8") : null;
    const text = this.seal(snapshot);
    this.verify(text);
    this.atomic(this.fileFor(snapshot.id), text);
    this.notify();
    return this.metadata(snapshot);
  }
  today() {
    return new Date(Date.now() + 4 * 36e5).toISOString().slice(0, 10);
  }
  ensureDaily() {
    const day = this.today();
    if (this.dailyDay === day) return;
    if (!this.list().some((s) => s.kind === "daily" && s.day === day)) this.create("daily");
    this.dailyDay = day;
  }
  download(id) {
    const snapshot = this.verify(fs.readFileSync(this.fileFor(id), "utf8"));
    return JSON.stringify({ format: "emgraphic-backup-v1", snapshot, deviceCookieKey: this.signingKey }, null, 2);
  }
  apply(snapshot) {
    for (const file of files) {
      const target = path.join(this.directory, file), content = snapshot.files[file];
      if (content === null) {
        if (fs.existsSync(target)) fs.unlinkSync(target);
      } else this.atomic(target, content);
    }
  }
  restore(id) {
    const raw = fs.readFileSync(this.fileFor(id), "utf8");
    const snapshot = this.verify(raw);
    const safety = this.create("before_restore");
    this.atomic(this.journal, raw);
    try {
      this.apply(snapshot);
      fs.unlinkSync(this.journal);
    } catch (error) {
      const rollbackRaw = fs.readFileSync(this.fileFor(safety.id), "utf8");
      this.atomic(this.journal, rollbackRaw);
      this.apply(this.verify(rollbackRaw));
      fs.unlinkSync(this.journal);
      throw error;
    }
    this.notify();
    return this.metadata(snapshot);
  }
};

// src/utils/clock.ts
function createSyncedClock(monotonicNow, wallNow) {
  let anchor = null;
  return {
    now: () => anchor ? anchor.serverTime + Math.max(0, monotonicNow() - anchor.monotonicTime) : wallNow(),
    synchronized: () => anchor !== null,
    synchronize(serverTime, started, received) {
      const roundTrip = received - started;
      if (!Number.isFinite(serverTime) || serverTime <= 0 || serverTime > 864e13 - 3e4 || !Number.isFinite(roundTrip) || roundTrip < 0 || roundTrip > 3e4) {
        throw new Error("Serverd\u0259n d\xFCzg\xFCn vaxt m\u0259lumat\u0131 al\u0131nmad\u0131.");
      }
      anchor = { serverTime: serverTime + roundTrip / 2, monotonicTime: received };
    }
  };
}
var clock = createSyncedClock(() => performance.now(), () => Date.now());
function getNowMs() {
  return typeof window === "undefined" ? Date.now() : clock.now();
}

// src/utils/bakuTime.ts
var BAKU_TIMEZONE = "Asia/Baku";
var formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BAKU_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});
function getBakuNowDetails(baseDate = new Date(getNowMs())) {
  const parts = formatter.formatToParts(baseDate);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
  const year = parseInt(getPart("year"), 10) || baseDate.getFullYear();
  const month = parseInt(getPart("month"), 10) || baseDate.getMonth() + 1;
  const day = parseInt(getPart("day"), 10) || baseDate.getDate();
  let hour = parseInt(getPart("hour"), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(getPart("minute"), 10) || 0;
  const second = parseInt(getPart("second"), 10) || 0;
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const decimalHour = hour + minute / 60;
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    decimalHour,
    timestamp: baseDate.getTime()
  };
}

// src/utils/bookingRules.ts
var MIN_ADVANCE_NOTICE_MINUTES = 30;
var MIN_ADVANCE_NOTICE_HOURS = MIN_ADVANCE_NOTICE_MINUTES / 60;
function checkSlotAdvanceStatus(dateStr, slot, minAdvanceHours = MIN_ADVANCE_NOTICE_HOURS, now = new Date(getNowMs())) {
  const baku = getBakuNowDetails(now);
  const todayBakuStr = baku.dateStr;
  if (dateStr < todayBakuStr) {
    return {
      isBookable: false,
      status: "past",
      label: "Vaxt\u0131 ke\xE7ib"
    };
  }
  const remaining = bookingStartsAt({ date: dateStr, timeSlot: slot }) - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return {
      isBookable: false,
      status: "past",
      label: "Vaxt\u0131 ke\xE7ib"
    };
  }
  if (minAdvanceHours > 0 && remaining < minAdvanceHours * 36e5) {
    return {
      isBookable: false,
      status: "insufficient_advance",
      label: "\u018Fn az\u0131 " + Math.round(minAdvanceHours * 60) + " d\u0259qiq\u0259 \xF6nc\u0259d\u0259n"
    };
  }
  return {
    isBookable: true,
    status: "available"
  };
}

// src/utils/studioSchedule.ts
var STUDIO_END_TIMES = [...ALL_TIME_SLOTS.slice(1), "20:30"];
function studioRangeSlots(start, end) {
  if (typeof start !== "string" || typeof end !== "string" || !ALL_TIME_SLOTS.includes(start) || !STUDIO_END_TIMES.includes(end) || start >= end) return null;
  return ALL_TIME_SLOTS.filter((slot) => slot >= start && slot < end);
}

// src/utils/cancellation.ts
var CANCELLATION_RULE = "Qeydiyyat\u0131 \xE7\u0259kili\u015F ba\u015Flayana q\u0259d\u0259r l\u0259\u011Fv ed\u0259 bil\u0259rsiniz.";
var CANCELLATION_CLOSED_MESSAGE = "\xC7\u0259kili\u015Fin vaxt\u0131 art\u0131q ba\u015Flay\u0131b. Bu qeydiyyat\u0131 l\u0259\u011Fv etm\u0259k \xFC\xE7\xFCn studiya il\u0259 \u0259laq\u0259 saxlay\u0131n.";
function cancellationDeadline(booking) {
  return bookingStartsAt(booking);
}
function canClientCancelBooking(booking, now = Date.now()) {
  return booking.status === "confirmed" && now < cancellationDeadline(booking);
}

// server/vinetka.ts
function parseVinetkaGroup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Vinetka qrupunun m\u0259lumatlar\u0131n\u0131 d\xFCzg\xFCn doldurun.");
  const fields = value;
  const text = (field, label, minimum, maximum) => {
    const raw = fields[field];
    if (typeof raw !== "string") throw new Error(label + " daxil edin.");
    const clean = raw.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (clean.length < minimum || clean.length > maximum) throw new Error(label + " " + minimum + "\u2013" + maximum + " simvol olmal\u0131d\u0131r.");
    return clean;
  };
  const schoolName = text("schoolName", "M\u0259kt\u0259bin ad\u0131", 2, 150);
  const className = text("className", "Sinif", 1, 40);
  const contactName = text("contactName", "M\u0259sul \u015F\u0259xsin ad\u0131", 2, 100);
  const studentCount = fields.studentCount;
  if (typeof studentCount !== "number" || !Number.isInteger(studentCount) || studentCount < 1 || studentCount > 2e3) throw new Error("\u015Eagird say\u0131 1\u20132000 aras\u0131 tam \u0259d\u0259d olmal\u0131d\u0131r.");
  const phone = typeof fields.contactPhone === "string" ? normalizePhone(fields.contactPhone) : "";
  if (!phone) throw new Error("M\u0259sul \u015F\u0259xsin d\xFCzg\xFCn Az\u0259rbaycan \u0259laq\u0259 n\xF6mr\u0259sini daxil edin.");
  return { schoolName, className, studentCount, contactName, contactPhone: "+994" + phone };
}

// src/utils/bookingWindow.ts
var MAX_BOOKING_ADVANCE_DAYS = 90;
function getLastBookableDate(nowMs = Date.now()) {
  const bakuDay = new Date(nowMs + 4 * 36e5).toISOString().slice(0, 10);
  const end = /* @__PURE__ */ new Date(bakuDay + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + MAX_BOOKING_ADVANCE_DAYS);
  return end.toISOString().slice(0, 10);
}
function isWithinBookingWindow(date, nowMs = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return false;
  const today = new Date(nowMs + 4 * 36e5).toISOString().slice(0, 10);
  return date >= today && date <= getLastBookableDate(nowMs);
}

// server/liveConnections.ts
var LiveConnectionLimit = class {
  constructor(maximumPerIp = 16, maximumTotal = 256) {
    this.maximumPerIp = maximumPerIp;
    this.maximumTotal = maximumTotal;
    this.perIp = /* @__PURE__ */ new Map();
    this.total = 0;
  }
  acquire(ip) {
    const count = this.perIp.get(ip) || 0;
    if (count >= this.maximumPerIp || this.total >= this.maximumTotal) return;
    this.perIp.set(ip, count + 1);
    this.total++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.total--;
      const remaining = (this.perIp.get(ip) || 1) - 1;
      if (remaining) this.perIp.set(ip, remaining);
      else this.perIp.delete(ip);
    };
  }
};

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var isProduction = process.env.NODE_ENV === "production" || !process.env.NODE_ENV && process.argv[1]?.endsWith("server.js");
app.set("trust proxy", process.env.TRUST_PROXY === "loopback" ? "loopback" : false);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'" + (isProduction ? "" : " 'unsafe-inline'") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  });
  if (req.secure) res.set("Strict-Transport-Security", "max-age=15552000");
  next();
});
var PORT = process.env.PORT || 3e3;
var HOST = process.env.HOST || "0.0.0.0";
var DATA_DIR = path2.resolve(process.env.DATA_DIR || path2.join(__dirname, "data"));
var DB_FILE = path2.resolve(DATA_DIR, "bookings.json");
var LOGO_FILE = path2.resolve(DATA_DIR, "logo.json");
var SETTINGS_FILE = path2.resolve(DATA_DIR, "settings.json");
var BLOCKS_FILE = path2.resolve(DATA_DIR, "studio-blocks.json");
var backups;
var liveClients = /* @__PURE__ */ new Set();
var liveConnectionLimit = new LiveConnectionLimit();
var revision = 0;
function publishUpdate() {
  revision++;
  for (const client of liveClients) {
    if (client.writableEnded || client.destroyed) {
      liveClients.delete(client);
      continue;
    }
    if (client.writableLength > 64 * 1024) {
      client.end();
      liveClients.delete(client);
      continue;
    }
    client.write("event: update\ndata: " + JSON.stringify({ revision }) + "\n\n");
  }
}
var parseLogoUpload = express.json({ limit: "12mb", inflate: false });
app.use("/api/settings/logo", (req, res, next) => {
  if (req.method !== "POST") return next();
  return adminLimiter(req, res, () => requireAdmin(req, res, () => parseLogoUpload(req, res, next)));
});
app.use(express.json({ limit: "50kb", inflate: false }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
function atomicWriteFileSync(filePath, content) {
  backups?.ensureDaily();
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  try {
    fs2.writeFileSync(tempPath, content, { encoding: "utf-8", mode: 384, flag: "wx", flush: true });
    fs2.renameSync(tempPath, filePath);
  } finally {
    if (fs2.existsSync(tempPath)) fs2.unlinkSync(tempPath);
  }
  publishUpdate();
}
if (!fs2.existsSync(DATA_DIR)) {
  fs2.mkdirSync(DATA_DIR, { recursive: true, mode: 448 });
}
if (process.platform !== "win32") fs2.chmodSync(DATA_DIR, 448);
if (!fs2.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
    whatsappNumber: "+994 77 607 97 07",
    studioAddress: "H\xF6vsan, M\u0130DA 1, Bina 1",
    studioName: "Emgraphic Studio",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  atomicWriteFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
}
if (!fs2.existsSync(DB_FILE)) {
  atomicWriteFileSync(DB_FILE, JSON.stringify([], null, 2));
}
var DEVICE_KEY_FILE = path2.join(DATA_DIR, ".device-cookie-key");
if (!fs2.existsSync(DEVICE_KEY_FILE)) fs2.writeFileSync(DEVICE_KEY_FILE, randomBytes3(32).toString("hex"), { mode: 384, flag: "wx" });
var DEVICE_KEY = fs2.readFileSync(DEVICE_KEY_FILE, "utf8").trim();
if (!/^[a-f0-9]{64}$/.test(DEVICE_KEY)) throw new Error("Invalid device cookie signing key.");
if (!fs2.existsSync(BLOCKS_FILE)) atomicWriteFileSync(BLOCKS_FILE, "[]");
readBookings();
backups = new StudioBackups(DATA_DIR, DEVICE_KEY, publishUpdate);
backups.ensureDaily();
setInterval(() => {
  try {
    backups.ensureDaily();
  } catch (err) {
    console.error("Daily backup failed:", err);
  }
}, 6e4).unref();
function studioSlotBlocked(date, slot) {
  return readStudioBlocks(DATA_DIR).some((b) => !b.releasedAt && b.date === date && b.timeSlots.some((s) => isSameOrMatchingSlot(s, slot)));
}
app.use((req, res, next) => {
  if ((req.path === "/api" || req.path.startsWith("/api/")) && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && origin !== req.protocol + "://" + req.get("host")) {
      return res.status(403).json({ success: false, error: "Sor\u011Funun m\u0259nb\u0259yin\u0259 icaz\u0259 verilmir." });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: "D\xFCzg\xFCn JSON m\u0259lumat\u0131 g\xF6nd\u0259rin." });
    }
  }
  res.locals.deviceTokenHash = visitorDevice(req, res, DEVICE_KEY);
  next();
});
var bookingCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "H\u0259ddind\u0259n art\u0131q sayda qeydiyyat c\u0259hdi edildi. Z\u0259hm\u0259t olmasa 15 d\u0259qiq\u0259 sonra yenid\u0259n c\u0259hd edin."
  }
});
var cancelLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "H\u0259ddind\u0259n art\u0131q sayda l\u0259\u011Fvetm\u0259 c\u0259hdi edildi. Z\u0259hm\u0259t olmasa bir q\u0259d\u0259r sonra c\u0259hd edin."
  }
});
var searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "\xC7ox sayda axtar\u0131\u015F sor\u011Fusu g\xF6nd\u0259rildi. Z\u0259hm\u0259t olmasa bir q\u0259d\u0259r sonra c\u0259hd edin."
  }
});
var adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "H\u0259ddind\u0259n art\u0131q sayda inzibat\xE7\u0131 sor\u011Fusu g\xF6nd\u0259rildi. Z\u0259hm\u0259t olmasa bir q\u0259d\u0259r sonra c\u0259hd edin."
  }
});
var adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\xC7ox sayda yenil\u0259m\u0259 sor\u011Fusu. Bir q\u0259d\u0259r sonra yenid\u0259n yoxlay\u0131n." }
});
var ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();
if (!ADMIN_KEY) {
  throw new Error("ADMIN_KEY t\u0259yin edilm\u0259yib. .env fayl\u0131nda inzibat\xE7\u0131 \u015Fifr\u0259sini t\u0259yin edin.");
}
function isValidAdminKey(adminKey) {
  if (!adminKey) return false;
  return typeof adminKey === "string" && sameSecret(adminKey.trim(), ADMIN_KEY);
}
function requireAdmin(req, res, next) {
  if (!isValidAdminKey(req.headers["x-admin-key"])) return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  next();
}
app.get("/api/admin/studio-blocks", adminReadLimiter, requireAdmin, (_req, res) => {
  res.json({ success: true, blocks: readStudioBlocks(DATA_DIR) });
});
app.post("/api/admin/studio-blocks", adminLimiter, requireAdmin, (req, res) => {
  const { date, startTime, endTime, reason = "Vinetka \xE7\u0259kili\u015Fi" } = req.body;
  const hasRange = startTime !== void 0 || endTime !== void 0;
  const timeSlots = hasRange ? studioRangeSlots(startTime, endTime) : req.body.timeSlots;
  if (hasRange && (!timeSlots || req.body.timeSlots !== void 0)) {
    return res.status(400).json({ success: false, error: "Ba\u015Flan\u011F\u0131c v\u0259 biti\u015F saatlar\u0131n\u0131 d\xFCzg\xFCn se\xE7in. Biti\u015F ba\u015Flan\u011F\u0131cdan sonra olmal\u0131d\u0131r." });
  }
  if (!validStudioDate(date) || date < getBakuTodayStr() || !Array.isArray(timeSlots) || !timeSlots.length || timeSlots.length > ALL_TIME_SLOTS.length || timeSlots.some((s) => typeof s !== "string" || !ALL_TIME_SLOTS.includes(s)) || typeof reason !== "string" || !reason.trim() || reason.trim().length > 150) {
    return res.status(400).json({ success: false, error: "Tarix, saatlar v\u0259 q\u0131sa s\u0259b\u0259b d\xFCzg\xFCn daxil edilm\u0259lidir." });
  }
  let group;
  if (req.body.group !== void 0) {
    try {
      group = parseVinetkaGroup(req.body.group);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
  const blocks = readStudioBlocks(DATA_DIR), bookings = readBookings();
  const selected = [...new Set(timeSlots)].sort();
  const conflicts = selected.filter((slot) => studioSlotBlocked(date, slot) || bookings.some((b) => isActiveBooking(b) && b.date === date && isSameOrMatchingSlot(b.timeSlot, slot)));
  if (conflicts.length) return res.status(409).json({ success: false, error: "Bu saatlar art\u0131q doludur: " + conflicts.join(", ") + ". Siyah\u0131n\u0131 yenil\u0259yin." });
  const block = { id: randomUUID2(), date, timeSlots: selected, reason: reason.trim(), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  if (group) block.group = group;
  blocks.push(block);
  atomicWriteFileSync(BLOCKS_FILE, JSON.stringify(blocks, null, 2));
  res.json({ success: true, block });
});
app.post("/api/admin/studio-blocks/group", adminLimiter, requireAdmin, (req, res) => {
  const blocks = readStudioBlocks(DATA_DIR);
  const block = blocks.find((b) => b.id === req.body.id);
  if (!block) return res.status(404).json({ success: false, error: "\xC7\u0259kili\u015F aral\u0131\u011F\u0131 tap\u0131lmad\u0131. Siyah\u0131n\u0131 yenil\u0259yin." });
  if (req.body.expectedVersion !== (block.updatedAt || block.createdAt)) return res.status(409).json({ success: false, error: "Bu qeyd art\u0131q d\u0259yi\u015Fdirilib. P\u0259nc\u0259r\u0259ni ba\u011Flay\u0131b m\u0259lumatlar\u0131 yenid\u0259n a\xE7\u0131n." });
  try {
    block.group = parseVinetkaGroup(req.body.group);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  block.updatedAt = new Date(Math.max(Date.now(), Date.parse(block.updatedAt || block.createdAt) + 1)).toISOString();
  atomicWriteFileSync(BLOCKS_FILE, JSON.stringify(blocks, null, 2));
  res.json({ success: true, block });
});
app.post("/api/admin/studio-blocks/delete", adminLimiter, requireAdmin, (req, res) => {
  const blocks = readStudioBlocks(DATA_DIR);
  const target = blocks.find((b) => b.id === req.body.id);
  if (!target) return res.status(404).json({ success: false, error: "Ba\u011Flanm\u0131\u015F saatlar tap\u0131lmad\u0131." });
  if (target.releasedAt) return res.status(409).json({ success: false, error: "Bu saatlar art\u0131q a\xE7\u0131l\u0131b. Siyah\u0131n\u0131 yenil\u0259yin." });
  if (target.group) {
    target.releasedAt = (/* @__PURE__ */ new Date()).toISOString();
    target.updatedAt = new Date(Math.max(Date.now(), Date.parse(target.updatedAt || target.createdAt) + 1)).toISOString();
  }
  atomicWriteFileSync(BLOCKS_FILE, JSON.stringify(target.group ? blocks : blocks.filter((b) => b.id !== req.body.id), null, 2));
  res.json({ success: true });
});
app.get("/api/admin/backups", adminReadLimiter, requireAdmin, (_req, res) => res.json({ success: true, backups: backups.list() }));
app.post("/api/admin/backups", adminLimiter, requireAdmin, (_req, res) => res.json({ success: true, backup: backups.create() }));
app.get("/api/admin/backups/:id/download", adminReadLimiter, requireAdmin, (req, res) => {
  try {
    const content = backups.download(req.params.id);
    res.set("Content-Disposition", 'attachment; filename="emgraphic-backup-' + req.params.id + '.json"');
    res.type("application/json").send(content);
  } catch {
    res.status(404).json({ success: false, error: "Sa\u011Flam ehtiyat n\xFCsx\u0259 tap\u0131lmad\u0131." });
  }
});
app.post("/api/admin/backups/:id/restore", adminLimiter, requireAdmin, (req, res) => {
  if (req.body.confirmId !== req.params.id) return res.status(400).json({ success: false, error: "B\u0259rpa t\u0259sdiqi t\u0259l\u0259b olunur." });
  try {
    res.json({ success: true, backup: backups.restore(req.params.id) });
  } catch (err) {
    console.error("Backup restore failed:", err);
    res.status(500).json({ success: false, error: "N\xFCsx\u0259ni b\u0259rpa etm\u0259k m\xFCmk\xFCn olmad\u0131. M\u0259lumatlar yoxlan\u0131lmal\u0131d\u0131r." });
  }
});
var BAKU_TIMEZONE2 = "Asia/Baku";
function getBakuNowDetails2(baseDate = /* @__PURE__ */ new Date()) {
  const formatter2 = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKU_TIMEZONE2,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter2.formatToParts(baseDate);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
  const year = parseInt(getPart("year"), 10) || baseDate.getFullYear();
  const month = parseInt(getPart("month"), 10) || baseDate.getMonth() + 1;
  const day = parseInt(getPart("day"), 10) || baseDate.getDate();
  let hour = parseInt(getPart("hour"), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(getPart("minute"), 10) || 0;
  const second = parseInt(getPart("second"), 10) || 0;
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const decimalHour = hour + minute / 60;
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    decimalHour,
    timestamp: baseDate.getTime()
  };
}
function getBakuTodayStr(baseDate) {
  return getBakuNowDetails2(baseDate).dateStr;
}
function readBookings() {
  try {
    if (fs2.existsSync(DB_FILE)) {
      const raw = fs2.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rotated = rotateExposedBookingSecrets(parsed);
        const finished = finishElapsedBookings(parsed);
        if (rotated || finished) writeBookings(parsed);
        return parsed;
      }
      throw new Error("Qeydiyyat fayl\u0131n\u0131n format\u0131 d\xFCzg\xFCn deyil.");
    }
  } catch (err) {
    console.error("Error reading bookings DB:", err);
    throw err;
  }
  return [];
}
function writeBookings(bookings) {
  atomicWriteFileSync(DB_FILE, JSON.stringify(bookings, null, 2));
}
setInterval(() => {
  try {
    readBookings();
  } catch (err) {
    console.error("Attendance update failed:", err);
  }
}, 15e3).unref();
app.get("/api/events", (req, res) => {
  const release = liveConnectionLimit.acquire(req.ip || req.socket.remoteAddress || "unknown");
  if (!release) return res.status(429).set("Retry-After", "30").json({ success: false, error: "Canl\u0131 ba\u011Flant\u0131 h\u0259ddi dolub. Bir q\u0259d\u0259r sonra yenid\u0259n qo\u015Fulun." });
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  liveClients.add(res);
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded && res.writableLength < 64 * 1024) res.write(": keep-alive\n\n");
    else res.end();
  }, 2e4);
  const lifetime = setTimeout(() => res.end(), 30 * 60 * 1e3);
  const cleanup = () => {
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    liveClients.delete(res);
    release();
  };
  res.once("close", cleanup);
  req.once("aborted", cleanup);
  res.once("error", cleanup);
});
function generateUniqueReferenceCode(existingBookings) {
  const existingCodes = new Set(existingBookings.map((b) => b.referenceCode));
  let code = "";
  let attempts = 0;
  do {
    attempts++;
    const num = Math.floor(1e4 + Math.random() * 9e4);
    code = `EM-${num}`;
    if (attempts > 100) {
      code = `EM-${Date.now().toString().slice(-6)}`;
      break;
    }
  } while (existingCodes.has(code));
  return code;
}
function checkAdvanceNotice(dateStr, slotStr) {
  const advance = checkSlotAdvanceStatus(dateStr, slotStr);
  if (advance.isBookable) return { isValid: true };
  const baku = getBakuNowDetails2();
  return {
    isValid: false,
    error: advance.status === "insufficient_advance" ? "\xC7\u0259kili\u015F\u0259 \u0259n az\u0131 " + MIN_ADVANCE_NOTICE_MINUTES + " d\u0259qiq\u0259 \xF6nc\u0259d\u0259n yaz\u0131lmaq laz\u0131md\u0131r (Cari Bak\u0131 vaxt\u0131: " + baku.timeStr + "). Z\u0259hm\u0259t olmasa daha sonrak\u0131 saat\u0131 se\xE7in." : "Se\xE7ilmi\u015F tarix v\u0259 saat art\u0131q ke\xE7ib (Bak\u0131 vaxt\u0131 il\u0259). Z\u0259hm\u0259t olmasa g\u0259l\u0259c\u0259k vaxt se\xE7in."
  };
}
app.get("/api/time", (_req, res) => {
  const details = getBakuNowDetails2();
  res.json({
    timeZone: "Asia/Baku",
    utcOffset: "+04:00",
    bakuDate: details.dateStr,
    bakuTime: details.timeStr,
    hour: details.hour,
    minute: details.minute,
    second: details.second,
    decimalHour: details.decimalHour,
    timestamp: details.timestamp
  });
});
app.get("/api/settings/logo", (_req, res) => {
  try {
    if (fs2.existsSync(LOGO_FILE)) {
      const data = JSON.parse(fs2.readFileSync(LOGO_FILE, "utf-8"));
      return res.json({ logoUrl: data.logoUrl || null });
    }
    return res.json({ logoUrl: null });
  } catch {
    return res.json({ logoUrl: null });
  }
});
app.post("/api/settings/logo", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di. D\xFCzg\xFCn admin \u015Fifr\u0259si t\u0259l\u0259b olunur." });
  }
  try {
    const { logoUrl } = req.body;
    if (typeof logoUrl !== "string" || logoUrl !== "" && !/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logoUrl)) {
      return res.status(400).json({ success: false, error: "D\xFCzg\xFCn \u015F\u0259kil fayl\u0131 t\u0259qdim edin." });
    }
    if (logoUrl !== void 0) {
      atomicWriteFileSync(
        LOGO_FILE,
        JSON.stringify({ logoUrl: logoUrl || null, updatedAt: (/* @__PURE__ */ new Date()).toISOString() })
      );
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "Loqo m\u0259lumat\u0131 t\u0259qdim olunmay\u0131b." });
  } catch {
    return res.status(500).json({ error: "Loqonu saxlamaq m\xFCmk\xFCn olmad\u0131." });
  }
});
app.get("/api/settings", (_req, res) => {
  try {
    if (fs2.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs2.readFileSync(SETTINGS_FILE, "utf-8"));
      if (!data || Array.isArray(data) || typeof data.whatsappNumber !== "string") throw new Error("Invalid settings");
      return res.json({ success: true, settings: data });
    }
    throw new Error("Settings file missing");
  } catch {
    return res.status(500).json({ success: false, error: "Studiya m\u0259lumatlar\u0131n\u0131 oxumaq m\xFCmk\xFCn olmad\u0131. Yenid\u0259n c\u0259hd edin." });
  }
});
app.post("/api/settings", adminLimiter, (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di. D\xFCzg\xFCn admin \u015Fifr\u0259si t\u0259l\u0259b olunur." });
  }
  try {
    const { whatsappNumber, studioAddress, studioName } = req.body;
    let current = {};
    if (fs2.existsSync(SETTINGS_FILE)) {
      current = JSON.parse(fs2.readFileSync(SETTINGS_FILE, "utf-8"));
      if (!current || Array.isArray(current) || typeof current !== "object") throw new Error("Invalid settings");
    }
    const normalizedWhatsApp = whatsappNumber === void 0 ? void 0 : normalizePhone(whatsappNumber);
    if (whatsappNumber !== void 0 && !normalizedWhatsApp) return res.status(400).json({ success: false, error: "D\xFCzg\xFCn Az\u0259rbaycan \u0259laq\u0259 n\xF6mr\u0259si daxil edin." });
    for (const [value, limit] of [[studioAddress, 300], [studioName, 100]]) {
      if (value !== void 0 && (typeof value !== "string" || value.trim().length < 2 || value.length > limit)) return res.status(400).json({ success: false, error: "Studiya ad\u0131 v\u0259 \xFCnvan\u0131n\u0131 d\xFCzg\xFCn daxil edin." });
    }
    const updated = {
      ...current,
      ...normalizedWhatsApp !== void 0 ? { whatsappNumber: toAzInternationalFull(normalizedWhatsApp) } : {},
      ...studioAddress !== void 0 ? { studioAddress: String(studioAddress).trim() } : {},
      ...studioName !== void 0 ? { studioName: String(studioName).trim() } : {},
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    atomicWriteFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return res.json({ success: true, settings: updated });
  } catch {
    return res.status(500).json({ success: false, error: "T\u0259nziml\u0259m\u0259l\u0259ri saxlamaq m\xFCmk\xFCn olmad\u0131." });
  }
});
app.get("/api/availability", (_req, res) => {
  const bookings = readBookings();
  const bookedSlots = bookings.filter(isActiveBooking).map((b) => ({
    date: b.date,
    timeSlot: b.timeSlot
  }));
  const studioSlots = readStudioBlocks(DATA_DIR).filter((b) => !b.releasedAt).flatMap((b) => b.timeSlots.map((timeSlot) => ({ date: b.date, timeSlot })));
  res.json({ success: true, bookedSlots: [...bookedSlots, ...studioSlots] });
});
function createBooking(req, res, isAdmin = false) {
  const { clientName, clientPhone, photoshootType, date, timeSlot, notes, deviceId, tokens } = req.body;
  const headerDeviceId = cleanDeviceId(req.headers["x-device-id"] || deviceId);
  const deviceTokenHash = isAdmin ? void 0 : res.locals.deviceTokenHash;
  const clientIp = (req.ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (![clientName, clientPhone, date, timeSlot, photoshootType].every((value) => typeof value === "string" && value.trim())) {
    return res.status(400).json({
      success: false,
      error: "Z\u0259hm\u0259t olmasa b\xFCt\xFCn t\u0259l\u0259b olunan xanalar\u0131 doldurun."
    });
  }
  const cleanName = clientName.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (cleanName.length < 2 || cleanName.length > 70) {
    return res.status(400).json({
      success: false,
      error: "Ad v\u0259 soyad 2 il\u0259 70 simvol aral\u0131\u011F\u0131nda olmal\u0131d\u0131r."
    });
  }
  const normPhone = normalizePhone(clientPhone);
  if (!normPhone || normPhone.length !== 9) {
    return res.status(400).json({
      success: false,
      error: "Z\u0259hm\u0259t olmasa d\xFCzg\xFCn Az\u0259rbaycan mobil n\xF6mr\u0259si daxil edin (m\u0259s: 50 123 45 67)."
    });
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({
      success: false,
      error: "Tarix format\u0131 d\xFCzg\xFCn deyil (YYYY-MM-DD t\u0259l\u0259b olunur)."
    });
  }
  if (!isWithinBookingWindow(date)) return res.status(400).json({ success: false, error: "Yaln\u0131z bu g\xFCn v\u0259 n\xF6vb\u0259ti " + MAX_BOOKING_ADVANCE_DAYS + " g\xFCn \xFC\xE7\xFCn qeydiyyat m\xFCmk\xFCnd\xFCr. Uy\u011Fun g\u0259l\u0259c\u0259k tarix se\xE7in." });
  if (!ALL_TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({
      success: false,
      error: "Se\xE7ilmi\u015F \xE7\u0259kili\u015F saat\u0131 studiyan\u0131n i\u015F qrafikin\u0259 uy\u011Fun deyil."
    });
  }
  const cleanType = String(photoshootType).trim();
  if (!PHOTOSHOOT_CATEGORIES.some((category) => category.id === cleanType)) {
    return res.status(400).json({
      success: false,
      error: "\xC7\u0259kili\u015F n\xF6v\xFC d\xFCzg\xFCn se\xE7ilm\u0259yib."
    });
  }
  const cleanNotes = notes ? String(notes).trim().slice(0, 500) : "";
  const bookings = readBookings();
  const todayStr = getBakuTodayStr();
  const advanceCheck = isAdmin ? { isValid: date >= todayStr, error: "Ke\xE7mi\u015F tarix\u0259 yeni qeydiyyat \u0259lav\u0259 edil\u0259 bilm\u0259z." } : checkAdvanceNotice(date, timeSlot);
  if (!advanceCheck.isValid) {
    return res.status(400).json({
      success: false,
      error: advanceCheck.error
    });
  }
  const isConflict = bookings.some(
    (b) => b.date === date && isSameOrMatchingSlot(b.timeSlot, timeSlot) && isActiveBooking(b)
  );
  if (studioSlotBlocked(date, timeSlot)) {
    return res.status(409).json({ success: false, error: "Bu saat studiya t\u0259r\u0259find\u0259n dolu qeyd edilib. Ba\u015Fqa saat se\xE7in." });
  }
  if (isConflict) {
    return res.status(409).json({
      success: false,
      error: "T\u0259\u0259ss\xFCf ki, bu saat art\u0131q ba\u015Fqa bir m\xFC\u015Ft\u0259ri t\u0259r\u0259find\u0259n bron edilib. Z\u0259hm\u0259t olmasa ba\u015Fqa saat se\xE7in."
    });
  }
  const existingActive = findActiveDuplicate(bookings, {
    clientName: cleanName,
    clientPhone: normPhone,
    deviceId: isAdmin ? void 0 : headerDeviceId,
    deviceTokenHash,
    tokens: isAdmin ? [] : cleanTokens(tokens)
  });
  if (existingActive) {
    return res.status(409).json({
      success: false,
      errorCode: "ACTIVE_BOOKING_EXISTS",
      error: "Bu n\xF6mr\u0259, ad v\u0259 ya cihaz \xFC\xE7\xFCn art\u0131q aktiv qeydiyyat var. \u018Fvv\u0259lki qeydiyyat\u0131 onu yaratd\u0131\u011F\u0131n\u0131z cihazdan l\u0259\u011Fv edin, sonra yenid\u0259n qeydiyyatdan ke\xE7in. Cihaza giri\u015Finiz yoxdursa, studiya il\u0259 \u0259laq\u0259 saxlay\u0131n."
    });
  }
  const referenceCode = generateUniqueReferenceCode(bookings);
  const clientSecret = randomBytes3(32).toString("hex");
  const newBooking = {
    id: randomUUID2(),
    referenceCode,
    clientSecret,
    clientName: cleanName,
    clientPhone: toAzInternationalFull(normPhone),
    photoshootType: cleanType,
    date,
    timeSlot,
    notes: cleanNotes,
    status: "confirmed",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    deviceId: isAdmin ? void 0 : headerDeviceId || void 0,
    deviceTokenHash,
    clientIp: clientIp || void 0
  };
  bookings.unshift(newBooking);
  writeBookings(bookings);
  console.log(`[BOOKING CREATED] ${newBooking.referenceCode} | ${newBooking.date} ${newBooking.timeSlot}`);
  res.json({
    success: true,
    booking: isAdmin ? newBooking : publicBooking(newBooking, true)
  });
}
app.post("/api/bookings", bookingCreationLimiter, (req, res) => createBooking(req, res));
app.post("/api/admin/bookings", adminLimiter, (req, res) => {
  if (!isValidAdminKey(req.headers["x-admin-key"])) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  }
  return createBooking(req, res, true);
});
app.post("/api/my-active-booking", (req, res) => {
  const tokenList = cleanTokens(req.body.tokens);
  const bookings = readBookings();
  const active = bookings.find((b) => {
    return isActiveBooking(b) && ownsBooking(b, res.locals.deviceTokenHash, tokenList);
  });
  if (!active) {
    return res.json({ hasActiveBooking: false, activeBooking: null });
  }
  const safeActive = {
    id: active.id,
    referenceCode: active.referenceCode,
    clientName: active.clientName,
    clientPhone: active.clientPhone,
    photoshootType: active.photoshootType,
    date: active.date,
    timeSlot: active.timeSlot,
    notes: active.notes,
    status: active.status,
    createdAt: active.createdAt
  };
  res.json({
    hasActiveBooking: true,
    activeBooking: safeActive
  });
});
app.post("/api/my-bookings", searchLimiter, (req, res) => {
  const tokenList = cleanTokens(req.body.tokens);
  const cleanReqPhone = req.body.phone ? normalizePhone(req.body.phone) : "";
  const bookings = readBookings();
  const matched = bookings.filter((b) => {
    return ownsBooking(b, res.locals.deviceTokenHash, tokenList) && (!req.body.phone || !!cleanReqPhone && normalizePhone(b.clientPhone) === cleanReqPhone);
  });
  const sanitized = matched.map((b) => ({
    id: b.id,
    referenceCode: b.referenceCode,
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    photoshootType: b.photoshootType,
    date: b.date,
    timeSlot: b.timeSlot,
    notes: b.notes,
    status: b.status,
    createdAt: b.createdAt,
    completedAt: b.completedAt,
    checkedInAt: b.checkedInAt,
    noShowAt: b.noShowAt,
    completionSource: b.completionSource,
    cancelledBy: b.cancelledBy
  }));
  res.json({
    success: true,
    bookings: sanitized
  });
});
app.post("/api/bookings/cancel", cancelLimiter, (req, res) => {
  const { bookingId, clientSecret } = req.body;
  if (!bookingId) {
    return res.status(400).json({ success: false, error: "Bron ID t\u0259l\u0259b olunur." });
  }
  const bookings = readBookings();
  const targetIndex = bookings.findIndex((b) => b.id === bookingId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Qeydiyyat tap\u0131lmad\u0131." });
  }
  const target = bookings[targetIndex];
  if (!ownsBooking(target, res.locals.deviceTokenHash, typeof clientSecret === "string" ? [clientSecret.trim()] : [])) {
    return res.status(403).json({
      success: false,
      error: "Bu qeydiyyat\u0131 l\u0259\u011Fv etm\u0259k h\xFCququnuz yoxdur (t\u0259hl\xFCk\u0259sizlik a\xE7ar\u0131 uy\u011Fun g\u0259lmir)."
    });
  }
  if (target.status !== "confirmed") {
    return res.status(400).json({
      success: false,
      error: 'Yaln\u0131z aktiv t\u0259sdiql\u0259nmi\u015F ("confirmed") qeydiyyatlar l\u0259\u011Fv edil\u0259 bil\u0259r.'
    });
  }
  if (!canClientCancelBooking(target)) {
    return res.status(400).json({ success: false, errorCode: "CANCELLATION_DEADLINE_PASSED", error: CANCELLATION_RULE + " " + CANCELLATION_CLOSED_MESSAGE });
  }
  target.status = "cancelled";
  target.cancelledBy = "client";
  writeBookings(bookings);
  console.log(`[BOOKING CANCELLED BY CLIENT] ${target.referenceCode} | ${target.date} ${target.timeSlot}`);
  res.json({
    success: true,
    message: "Qeydiyyat\u0131n\u0131z u\u011Furla l\u0259\u011Fv edildi v\u0259 saat d\u0259rhal t\u0259qvimd\u0259 bo\u015Fald\u0131ld\u0131."
  });
});
app.get("/api/admin/bookings", adminReadLimiter, (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di. D\xFCzg\xFCn admin \u015Fifr\u0259si daxil edin." });
  }
  const bookings = readBookings();
  res.json({ success: true, bookings });
});
app.post("/api/admin/bookings/status", adminLimiter, (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  }
  const { bookingId, status, expectedStatus } = req.body;
  const bookings = readBookings();
  const target = bookings.find((b) => b.id === bookingId);
  if (!target) {
    return res.status(404).json({ success: false, error: "Qeydiyyat tap\u0131lmad\u0131." });
  }
  if (expectedStatus && target.status !== expectedStatus) {
    return res.status(409).json({ success: false, error: "Bu qeydiyyat\u0131n statusu art\u0131q d\u0259yi\u015Fib. Siyah\u0131n\u0131 yenil\u0259yib yenid\u0259n yoxlay\u0131n." });
  }
  if (["confirmed", "checked_in", "cancelled", "completed", "no_show"].includes(status)) {
    if (status === "confirmed" || status === "checked_in") {
      if (studioSlotBlocked(target.date, target.timeSlot)) return res.status(409).json({ success: false, error: "Bu saat studiya t\u0259r\u0259find\u0259n dolu qeyd edilib. \u018Fvv\u0259lc\u0259 h\u0259min saat\u0131 a\xE7\u0131n." });
      if (findActiveDuplicate(bookings, target, target.id)) {
        return res.status(409).json({ success: false, error: "Bu m\xFC\u015Ft\u0259rinin v\u0259 ya cihaz\u0131n ba\u015Fqa aktiv qeydiyyat\u0131 var. \u018Fvv\u0259lc\u0259 onu l\u0259\u011Fv edin." });
      }
      const hasConflict = bookings.some(
        (b) => b.id !== target.id && b.date === target.date && isSameOrMatchingSlot(b.timeSlot, target.timeSlot) && isActiveBooking(b)
      );
      if (hasConflict) {
        return res.status(409).json({
          success: false,
          error: `Tarix (${target.date}) v\u0259 saat (${target.timeSlot}) \xFC\xE7\xFCn art\u0131q ba\u015Fqa aktiv t\u0259sdiql\u0259nmi\u015F bron m\xF6vcuddur. \u0130ki bron \xFCst-\xFCst\u0259 d\xFC\u015F\u0259 bilm\u0259z.`
        });
      }
      target.cancelledBy = null;
      delete target.completedAt;
      delete target.completionSource;
      delete target.noShowAt;
      if (status === "checked_in") {
        if (target.date !== getBakuTodayStr() || bookingEndsAt(target) <= Date.now()) {
          return res.status(400).json({ success: false, error: "G\u0259li\u015F yaln\u0131z bug\xFCnk\xFC, m\xFCdd\u0259ti bitm\u0259mi\u015F \xE7\u0259kili\u015F \xFC\xE7\xFCn qeyd edil\u0259 bil\u0259r. Ke\xE7mi\u015F \xE7\u0259kili\u015Fin n\u0259tic\u0259sini ayr\u0131ca se\xE7in." });
        }
        target.checkedInAt = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        delete target.checkedInAt;
      }
    } else if (status === "cancelled") {
      target.cancelledBy = "admin";
      delete target.completedAt;
      delete target.completionSource;
      delete target.checkedInAt;
      delete target.noShowAt;
    } else if (status === "completed") {
      target.cancelledBy = null;
      target.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      target.completionSource = "admin";
      delete target.noShowAt;
    } else if (status === "no_show") {
      if (bookingEndsAt(target) > Date.now()) {
        return res.status(400).json({ success: false, error: "\xC7\u0259kili\u015Fin vaxt\u0131 bitm\u0259d\u0259n m\xFC\u015Ft\u0259rini g\u0259lm\u0259di kimi qeyd etm\u0259k olmaz." });
      }
      target.cancelledBy = null;
      target.noShowAt = (/* @__PURE__ */ new Date()).toISOString();
      delete target.completedAt;
      delete target.completionSource;
      delete target.checkedInAt;
    }
    target.status = status;
    writeBookings(bookings);
    return res.json({ success: true, booking: target });
  }
  res.status(400).json({ success: false, error: "D\xFCzg\xFCn status t\u0259yin edilm\u0259yib." });
});
app.post("/api/admin/bookings/delete", adminLimiter, (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  }
  const { bookingId } = req.body;
  let bookings = readBookings();
  if (!bookings.some((booking) => booking.id === bookingId)) {
    return res.status(404).json({ success: false, error: "Qeydiyyat tap\u0131lmad\u0131." });
  }
  bookings = bookings.filter((b) => b.id !== bookingId);
  backups.create("before_delete");
  writeBookings(bookings);
  res.json({ success: true });
});
async function startServer() {
  const isProd = isProduction;
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "API \xFCnvan\u0131 tap\u0131lmad\u0131." });
  });
  app.use((err, _req, res, _next) => {
    console.error("API error:", err);
    const status = [400, 413, 415].includes(err.status) ? err.status : 500;
    res.status(status).json({
      success: false,
      error: status === 413 ? "Fayl\u0131n \xF6l\xE7\xFCs\xFC icaz\u0259 veril\u0259n h\u0259ddi a\u015F\u0131r." : status === 415 ? "S\u0131x\u0131lm\u0131\u015F sor\u011Fu m\u0259zmununa icaz\u0259 verilmir." : status === 400 ? "G\xF6nd\u0259ril\u0259n m\u0259lumat d\xFCzg\xFCn deyil." : "M\u0259lumat\u0131 saxlamaq m\xFCmk\xFCn olmad\u0131. Yenid\u0259n c\u0259hd edin."
    });
  });
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
        // Disables WebSocket completely to eliminate browser console WebSocket errors
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path2.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path2.resolve(__dirname, "dist/index.html"));
    });
  }
  app.listen(Number(PORT), HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}
startServer();
