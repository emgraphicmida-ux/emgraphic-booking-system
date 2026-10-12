// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// src/types/booking.ts
var ALL_TIME_SLOTS = [
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "12:00 - 13:00",
  "13:00 - 14:00",
  "14:00 - 15:00",
  "15:00 - 16:00",
  "16:00 - 17:00",
  "17:00 - 18:00",
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00"
];

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
var DATA_DIR = path.resolve(__dirname, "data");
var DB_FILE = path.resolve(DATA_DIR, "bookings.json");
var LOGO_FILE = path.resolve(DATA_DIR, "logo.json");
var SETTINGS_FILE = path.resolve(DATA_DIR, "settings.json");
app.use(express.json({ limit: "15mb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
    whatsappNumber: "+994 77 607 97 07",
    studioAddress: "H\xF6vsan, M\u0130DA 1, Bina 1",
    studioName: "Emgraphic Studio",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
}
var BAKU_TIMEZONE = "Asia/Baku";
function getBakuNowDetails(baseDate = /* @__PURE__ */ new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKU_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
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
function getBakuTodayStr(baseDate) {
  return getBakuNowDetails(baseDate).dateStr;
}
app.get("/api/time", (_req, res) => {
  const details = getBakuNowDetails();
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
    if (fs.existsSync(LOGO_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOGO_FILE, "utf-8"));
      return res.json({ logoUrl: data.logoUrl || null });
    }
    return res.json({ logoUrl: null });
  } catch (err) {
    return res.json({ logoUrl: null });
  }
});
app.post("/api/settings/logo", (req, res) => {
  try {
    const { logoUrl } = req.body;
    if (logoUrl) {
      fs.writeFileSync(LOGO_FILE, JSON.stringify({ logoUrl, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }));
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "No logoUrl provided" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save logo" });
  }
});
app.get("/api/settings", (_req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      return res.json({ success: true, settings: data });
    }
    return res.json({
      success: true,
      settings: {
        whatsappNumber: "+994 77 607 97 07",
        studioAddress: "H\xF6vsan, M\u0130DA 1, Bina 1",
        studioName: "Emgraphic Studio"
      }
    });
  } catch (err) {
    return res.json({
      success: true,
      settings: { whatsappNumber: "+994 77 607 97 07" }
    });
  }
});
app.post("/api/settings", (req, res) => {
  try {
    const { whatsappNumber, studioAddress, studioName } = req.body;
    let current = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        current = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      } catch {
      }
    }
    const updated = {
      ...current,
      ...whatsappNumber !== void 0 ? { whatsappNumber: String(whatsappNumber).trim() } : {},
      ...studioAddress !== void 0 ? { studioAddress: String(studioAddress).trim() } : {},
      ...studioName !== void 0 ? { studioName: String(studioName).trim() } : {},
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return res.json({ success: true, settings: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: "T\u0259nziml\u0259m\u0259l\u0259ri saxlamaq m\xFCmk\xFCn olmad\u0131." });
  }
});
if (!fs.existsSync(DB_FILE)) {
  const initialBookings = [
    {
      id: "book_initial_1",
      referenceCode: "EM-1081",
      clientSecret: "sec_initial_1",
      clientName: "Ayt\u0259n M\u0259mm\u0259dova",
      clientPhone: "+994 50 234 56 78",
      photoshootType: "1 dekor (20-25 kadr foto\u015F\u0259kil)",
      date: "2026-10-03",
      timeSlot: "11:00 - 12:00",
      notes: "Studio portret \xE7\u0259kili\u015Fi",
      status: "confirmed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "book_initial_2",
      referenceCode: "EM-1082",
      clientSecret: "sec_initial_2",
      clientName: "R\u0259\u015Fad Quliyev",
      clientPhone: "+994 55 987 65 43",
      photoshootType: "1 dekor + albom",
      date: "2026-10-03",
      timeSlot: "15:00 - 16:00",
      notes: "A\xE7\u0131q havada v\u0259 studiyada",
      status: "confirmed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    // Oct 14: Fully booked example
    ...ALL_TIME_SLOTS.map((slot, idx) => ({
      id: `book_oct14_${idx}`,
      referenceCode: `EM-40${idx + 10}`,
      clientSecret: `sec_oct14_${idx}`,
      clientName: `M\xFC\u015Ft\u0259ri #${idx + 1}`,
      clientPhone: `+994 50 111 22 3${idx}`,
      photoshootType: "1 dekor (20-25 kadr foto\u015F\u0259kil)",
      date: "2026-10-14",
      timeSlot: slot,
      status: "confirmed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }))
  ];
  fs.writeFileSync(DB_FILE, JSON.stringify(initialBookings, null, 2), "utf-8");
}
var memoryBookings = [];
function readBookings() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryBookings = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading bookings DB:", err);
  }
  return memoryBookings;
}
function writeBookings(bookings) {
  try {
    memoryBookings = bookings;
    fs.writeFileSync(DB_FILE, JSON.stringify(bookings, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing bookings DB:", err);
  }
}
function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("994")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(-9);
}
function checkAdvanceNotice(dateStr, slotStr) {
  const baku = getBakuNowDetails();
  const todayStr = baku.dateStr;
  if (dateStr < todayStr) {
    return {
      isValid: false,
      error: `Ke\xE7mi\u015F tarixl\u0259r\u0259 \xE7\u0259kili\u015F sifari\u015Fi q\u0259bul edilmir (Bak\u0131 vaxt\u0131 il\u0259).`
    };
  }
  if (dateStr > todayStr) {
    return { isValid: true };
  }
  const match = String(slotStr).match(/^(\d{1,2}):/);
  const slotStartHour = match ? parseInt(match[1], 10) : 0;
  const currentDecimalHour = baku.decimalHour;
  if (slotStartHour <= currentDecimalHour) {
    return {
      isValid: false,
      error: `Se\xE7ilmi\u015F saat art\u0131q ke\xE7mi\u015Fdir (Cari Bak\u0131 vaxt\u0131: ${baku.timeStr}). Z\u0259hm\u0259t olmasa sonrak\u0131 saat\u0131 v\u0259 ya sabahk\u0131 g\xFCn\xFC se\xE7in.`
    };
  }
  return { isValid: true };
}
app.get("/api/availability", (req, res) => {
  const bookings = readBookings();
  const bookedSlots = bookings.filter((b) => b.status === "confirmed").map((b) => ({
    date: b.date,
    timeSlot: b.timeSlot
  }));
  res.json({ success: true, bookedSlots });
});
app.post("/api/bookings", (req, res) => {
  const { clientName, clientPhone, photoshootType, date, timeSlot, notes, deviceId, deviceFingerprint } = req.body;
  const headerDeviceId = req.headers["x-device-id"] || deviceId;
  const headerDeviceFp = req.headers["x-device-fingerprint"] || deviceFingerprint;
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (!clientName || !clientPhone || !date || !timeSlot || !photoshootType) {
    return res.status(400).json({
      success: false,
      error: "Z\u0259hm\u0259t olmasa b\xFCt\xFCn t\u0259l\u0259b olunan xanalar\u0131 doldurun."
    });
  }
  const bookings = readBookings();
  const todayStr = getBakuTodayStr();
  const advanceCheck = checkAdvanceNotice(date, timeSlot);
  if (!advanceCheck.isValid) {
    return res.status(400).json({
      success: false,
      error: advanceCheck.error
    });
  }
  const isConflict = bookings.some(
    (b) => b.date === date && b.timeSlot === timeSlot && b.status === "confirmed"
  );
  if (isConflict) {
    return res.status(409).json({
      success: false,
      error: "T\u0259\u0259ss\xFCf ki, bu saat art\u0131q ba\u015Fqa bir m\xFC\u015Ft\u0259ri t\u0259r\u0259find\u0259n bron edilib. Z\u0259hm\u0259t olmasa ba\u015Fqa saat se\xE7in."
    });
  }
  const normPhone = normalizePhone(clientPhone);
  if (normPhone) {
    const existingActive = bookings.find(
      (b) => b.status === "confirmed" && b.date >= todayStr && normalizePhone(b.clientPhone) === normPhone
    );
    if (existingActive) {
      return res.status(409).json({
        success: false,
        error: `Daxil etdiyiniz \u0259laq\u0259 n\xF6mr\u0259si il\u0259 art\u0131q aktiv qeydiyyat m\xF6vcuddur (${existingActive.date}, saat ${existingActive.timeSlot}). Vaxt\u0131 d\u0259yi\u015Fm\u0259k \xFC\xE7\xFCn \u0259vv\u0259lc\u0259 m\xF6vcud qeydiyyat\u0131n\u0131z\u0131 l\u0259\u011Fv edin.`,
        activeBooking: existingActive
      });
    }
  }
  const referenceCode = `EM-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const clientSecret = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const newBooking = {
    id: `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    referenceCode,
    clientSecret,
    clientName: String(clientName).trim(),
    clientPhone: String(clientPhone).trim(),
    photoshootType,
    date,
    timeSlot,
    notes: notes ? String(notes).trim() : "",
    status: "confirmed",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    deviceId: headerDeviceId || void 0,
    deviceFingerprint: headerDeviceFp || void 0,
    clientIp: clientIp || void 0
  };
  bookings.unshift(newBooking);
  writeBookings(bookings);
  console.log(`\u2705 [BOOKING CREATED] ${newBooking.referenceCode} | ${newBooking.clientName} | ${newBooking.clientPhone} | ${newBooking.date} ${newBooking.timeSlot}`);
  res.json({
    success: true,
    booking: newBooking
  });
});
app.post("/api/my-active-booking", (req, res) => {
  const { deviceId, deviceFingerprint, tokens } = req.body;
  const headerDeviceId = req.headers["x-device-id"] || deviceId;
  const headerDeviceFp = req.headers["x-device-fingerprint"] || deviceFingerprint;
  const tokenList = Array.isArray(tokens) ? tokens : [];
  const bookings = readBookings();
  const todayStr = getBakuTodayStr();
  const active = bookings.find((b) => {
    if (b.status !== "confirmed" || b.date < todayStr) return false;
    if (b.clientSecret && tokenList.includes(b.clientSecret)) return true;
    if (headerDeviceId && b.deviceId && b.deviceId === headerDeviceId) return true;
    if (headerDeviceFp && b.deviceFingerprint && b.deviceFingerprint === headerDeviceFp) return true;
    return false;
  });
  res.json({
    hasActiveBooking: !!active,
    activeBooking: active || null
  });
});
app.post("/api/my-bookings", (req, res) => {
  const { tokens, phone, deviceId } = req.body;
  const headerDeviceId = req.headers["x-device-id"] || deviceId;
  const tokenList = Array.isArray(tokens) ? tokens : [];
  const cleanPhone = phone ? String(phone).replace(/[^\d]/g, "") : "";
  const bookings = readBookings();
  const myBookings = bookings.filter((b) => {
    if (b.clientSecret && tokenList.includes(b.clientSecret)) {
      return true;
    }
    if (headerDeviceId && b.deviceId && b.deviceId === headerDeviceId) {
      return true;
    }
    if (cleanPhone && cleanPhone.length >= 7) {
      const bPhone = b.clientPhone.replace(/[^\d]/g, "");
      if (bPhone.includes(cleanPhone)) {
        return true;
      }
    }
    return false;
  });
  res.json({
    success: true,
    bookings: myBookings
  });
});
app.post("/api/bookings/cancel", (req, res) => {
  const { bookingId, clientSecret, clientPhone, deviceId } = req.body;
  const headerDeviceId = req.headers["x-device-id"] || deviceId;
  if (!bookingId) {
    return res.status(400).json({ success: false, error: "Bron ID t\u0259l\u0259b olunur." });
  }
  const bookings = readBookings();
  const targetIndex = bookings.findIndex((b) => b.id === bookingId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Qeydiyyat tap\u0131lmad\u0131." });
  }
  const target = bookings[targetIndex];
  let isAuthorized = false;
  if (clientSecret && target.clientSecret === clientSecret) {
    isAuthorized = true;
  } else if (headerDeviceId && target.deviceId === headerDeviceId) {
    isAuthorized = true;
  } else if (clientPhone) {
    const cleanReqPhone = String(clientPhone).replace(/[^\d]/g, "");
    const cleanTargetPhone = target.clientPhone.replace(/[^\d]/g, "");
    if (cleanReqPhone && cleanTargetPhone.includes(cleanReqPhone)) {
      isAuthorized = true;
    }
  }
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      error: "Bu qeydiyyat\u0131 l\u0259\u011Fv etm\u0259k h\xFCququnuz yoxdur."
    });
  }
  target.status = "cancelled";
  target.cancelledBy = "client";
  writeBookings(bookings);
  res.json({
    success: true,
    message: "Qeydiyyat\u0131n\u0131z u\u011Furla l\u0259\u011Fv edildi v\u0259 saat d\u0259rhal bo\u015Fald\u0131ld\u0131.",
    booking: target
  });
});
function isValidAdminKey(adminKey) {
  if (!adminKey) return false;
  const k = String(adminKey).trim().toLowerCase();
  return k === "emgraphic2026" || k === "admin123" || k === "admin" || k === "emgraphic" || k === "emgraphicmida" || k === "123456" || k === "1234" || k === "mida1";
}
app.get("/api/admin/bookings", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di. D\xFCzg\xFCn \u015Fifr\u0259 daxil edin." });
  }
  const bookings = readBookings();
  res.json({ success: true, bookings });
});
app.post("/api/admin/bookings/status", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  }
  const { bookingId, status } = req.body;
  const bookings = readBookings();
  const target = bookings.find((b) => b.id === bookingId);
  if (target && (status === "confirmed" || status === "cancelled" || status === "completed")) {
    target.status = status;
    if (status === "cancelled") {
      target.cancelledBy = "admin";
    } else if (status === "completed") {
      target.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    } else if (status === "confirmed") {
      target.cancelledBy = null;
    }
    writeBookings(bookings);
    return res.json({ success: true, booking: target });
  }
  res.status(400).json({ success: false, error: "D\xFCzg\xFCn status v\u0259 ya qeydiyyat tap\u0131lmad\u0131." });
});
app.post("/api/admin/bookings/delete", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  }
  const { bookingId } = req.body;
  let bookings = readBookings();
  bookings = bookings.filter((b) => b.id !== bookingId);
  writeBookings(bookings);
  res.json({ success: true });
});
app.post("/api/admin/bookings/reset", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: "\u0130caz\u0259 verilm\u0259di." });
  }
  const initialBookings = [
    {
      id: "book_initial_1",
      referenceCode: "EM-1081",
      clientSecret: "sec_initial_1",
      clientName: "Ayt\u0259n M\u0259mm\u0259dova",
      clientPhone: "+994 50 234 56 78",
      photoshootType: "1 dekor (20-25 kadr foto\u015F\u0259kil)",
      date: "2026-10-06",
      timeSlot: "11:00 - 12:00",
      notes: "Studio portret \xE7\u0259kili\u015Fi",
      status: "confirmed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "book_initial_2",
      referenceCode: "EM-1082",
      clientSecret: "sec_initial_2",
      clientName: "R\u0259\u015Fad Quliyev",
      clientPhone: "+994 55 987 65 43",
      photoshootType: "1 dekor + albom",
      date: "2026-10-06",
      timeSlot: "15:00 - 16:00",
      notes: "A\xE7\u0131q havada v\u0259 studiyada",
      status: "confirmed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  writeBookings(initialBookings);
  res.json({ success: true, bookings: initialBookings });
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
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
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
