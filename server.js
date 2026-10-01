import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual, createSign } from "node:crypto";
import path from "node:path";
import { readFileSync } from "node:fs";
import webpush from "web-push";
import nodemailer from "nodemailer";
import helmet from "helmet";
import compression from "compression";
import { OAuth2Client } from "google-auth-library";
import { proximity } from "./lib/proximity.js";
import { fetchFlight, flightUpdate } from "./lib/flights.js";
const app = express();
const db = new DatabaseSync(process.env.DB_PATH || "arigreet.sqlite");
db.exec(
  `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT); CREATE TABLE IF NOT EXISTS greets(id TEXT PRIMARY KEY,owner TEXT,token TEXT UNIQUE,data TEXT);`,
);
// Behind Render/Fly/any HTTPS proxy, trust the first hop so rate limits see real IPs.
if (process.env.TRUST_PROXY !== "false") app.set("trust proxy", 1);
// gzip everything except the live event streams, which must flush at once.
app.use(
  compression({
    filter: (req, res) => !req.path.endsWith("/events") && compression.filter(req, res),
  }),
);
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.use(express.json({ limit: "5mb" }));
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://accounts.google.com/gsi/client"],
        "style-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style", "https://fonts.googleapis.com"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "connect-src": ["'self'", "https://accounts.google.com/gsi/"],
        "frame-src": ["https://accounts.google.com/gsi/"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "worker-src": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": null,
      },
    },
    // Phones on the same Wi-Fi open the app over plain http during testing.
    strictTransportSecurity: false,
    // Google's sign-in popup needs to talk back to this page.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);
db.exec(
  "CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,user TEXT,greet TEXT,data TEXT); CREATE TABLE IF NOT EXISTS resets(token TEXT PRIMARY KEY,user TEXT,expires INTEGER); CREATE TABLE IF NOT EXISTS profiles(user TEXT PRIMARY KEY,data TEXT)",
);
let vapid = db.prepare("SELECT value FROM settings WHERE key=?").get("vapid");
if (!vapid) {
  const generated = webpush.generateVAPIDKeys();
  db.prepare("INSERT INTO settings VALUES(?,?)").run(
    "vapid",
    JSON.stringify(generated),
  );
  vapid = { value: JSON.stringify(generated) };
}
const vapidKeys = JSON.parse(vapid.value);
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:support@arigreet.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);
const key = () => randomBytes(24).toString("hex");
const hash = (p, s) => scryptSync(p, s, 64).toString("hex");
const streams = new Map();
const APP_ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost"];
// Google sign-in: the web client ID (also used by the Android app) and, later, the iPhone one.
const GOOGLE_IDS = [process.env.GOOGLE_WEB_CLIENT_ID, ...(process.env.GOOGLE_EXTRA_CLIENT_IDS || "").split(",")]
  .map((v) => (v || "").trim())
  .filter(Boolean);
const google = new OAuth2Client();
const authAttempts = new Map();
app.use("/api/auth", (req, res, next) => {
  const ip = req.ip;
  const entry = authAttempts.get(ip) || { at: Date.now(), count: 0 };
  if (Date.now() - entry.at > 15 * 60000) {
    entry.at = Date.now();
    entry.count = 0;
  }
  entry.count++;
  authAttempts.set(ip, entry);
  if (entry.count > 30)
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  next();
});
app.use("/api", (req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  const origin = req.headers.origin;
  // The Android and iPhone apps load their screens from inside the phone,
  // so their requests come from these origins.
  if (origin && APP_ORIGINS.includes(origin)) {
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Guest-Token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
    if (req.method === "OPTIONS") return res.sendStatus(204);
  } else if (origin && new URL(origin).host !== req.headers.host)
    return res.status(403).json({ error: "Request origin is not allowed." });
  next();
});
db.exec(
  "CREATE TABLE IF NOT EXISTS session_expiry(token TEXT PRIMARY KEY,expires INTEGER)",
);
db.exec(
  `INSERT OR IGNORE INTO session_expiry SELECT token, ${Date.now() + 7 * 86400000} FROM sessions`,
);
// What leaves the server: the owner's account id stays private.
const view = ({ owner, ...g }) => g;
function publish(g) {
  for (const res of streams.get(g.id) || [])
    res.write(`data: ${JSON.stringify(view(g))}\n\n`);
}
// Fields a greeter may set on a Greet. Everything else is server-owned.
const GREET_FIELDS = [
  "name", "phone", "email", "language", "photo", "flight", "date", "airport",
  "airportCode", "airportTimezone", "airportFull", "airportLat", "airportLng", "terminal", "time", "area", "exit",
  "landmark", "instructions", "greeter", "company", "contact", "allowCall",
  "greeterPhoto", "vehicle", "colour", "plate", "vehiclePhoto",
  "passengers", "bags", "childSeat", "assistance", "notes", "theme", "beacon",
  "boardName", "boardOrientation", "boardShowFlight", "boardShowLogo",
  "companyLogo", "saveVehicle",
];
const IMAGE_FIELDS = ["photo", "greeterPhoto", "vehiclePhoto", "companyLogo"];
const safeImage = (v) =>
  /^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/.test(String(v || ""))
    ? String(v).slice(0, 400000)
    : "";
function greetFields(body = {}) {
  const out = {};
  for (const k of GREET_FIELDS) {
    const v = body[k];
    if (v === undefined) continue;
    if (IMAGE_FIELDS.includes(k)) out[k] = safeImage(v);
    else if (typeof v === "string") out[k] = v.slice(0, 2000);
    else if (typeof v === "boolean" || typeof v === "number") out[k] = v;
  }
  return out;
}
// to: "greeter" (owner's devices), "guest" (devices subscribed from the link), or "both"
/* Native app alerts (Android, later iPhone) go through Firebase Cloud
   Messaging. FIREBASE_SERVICE_ACCOUNT holds the service-account JSON from the
   Firebase console. No SDK needed: we sign the OAuth token ourselves. */
let fcmToken = { value: "", until: 0 };
const fcmAccount = () => {
  try {
    return process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
};
async function fcmAccess(acct) {
  if (fcmToken.until > Date.now() + 60000) return fcmToken.value;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) +
    "." +
    b64({
      iss: acct.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const sig = createSign("RSA-SHA256").update(unsigned).sign(acct.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig }),
  });
  const j = await r.json();
  if (!j.access_token) throw Error("FCM auth failed");
  fcmToken = { value: j.access_token, until: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmToken.value;
}
async function sendNative(token, title, body, url) {
  const acct = fcmAccount();
  if (!acct) return;
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${acct.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: "Bearer " + (await fcmAccess(acct)), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url },
        android: { priority: "high", notification: { channel_id: "greets", sound: "default" } },
      },
    }),
  });
  if (r.status === 404 || r.status === 400) {
    const e = Error("stale token");
    e.statusCode = 410;
    throw e;
  }
}
async function push(g, title, body, to = "both") {
  if (to === true) to = "greeter";
  const rows =
    to === "greeter"
      ? db.prepare("SELECT * FROM subscriptions WHERE user=?").all(g.owner)
      : to === "guest"
        ? db
            .prepare(
              "SELECT * FROM subscriptions WHERE greet=? AND user IS NULL",
            )
            .all(g.id)
        : db
            .prepare("SELECT * FROM subscriptions WHERE user=? OR greet=?")
            .all(g.owner, g.id);
  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const data = JSON.parse(row.data);
        const url = row.user ? "/app" : "/g/" + g.token;
        if (data.fcm) await sendNative(data.fcm, title, body, url);
        else await webpush.sendNotification(data, JSON.stringify({ title, body, url }));
      } catch (e) {
        if ([404, 410].includes(e.statusCode))
          db.prepare("DELETE FROM subscriptions WHERE id=?").run(row.id);
      }
    }),
  );
}
function user(req) {
  return db
    .prepare(
      "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON s.user=u.id JOIN session_expiry e ON e.token=s.token WHERE s.token=? AND e.expires>?",
    )
    .get(req.headers.authorization?.replace("Bearer ", "") || "", Date.now());
}
function load(id) {
  const r = db
    .prepare("SELECT * FROM greets WHERE id=? OR token=?")
    .get(id, id);
  return r
    ? { ...JSON.parse(r.data), id: r.id, owner: r.owner, token: r.token }
    : null;
}
function save(g) {
  db.prepare("UPDATE greets SET data=? WHERE id=?").run(
    JSON.stringify(g),
    g.id,
  );
  publish(g);
}
function access(req, g) {
  return (
    g &&
    (user(req)?.id === g.owner ||
      ((req.headers["x-guest-token"] === g.token ||
        req.query.token === g.token) &&
        g.expires > Date.now()))
  );
}
app.post("/api/auth/:mode", (req, res, next) => {
  if (!["login", "register"].includes(req.params.mode)) return next();
  try {
    const { email, password, name } = req.body;
    if (!email || !password || password.length < 10)
      return res.status(400).json({
        error: "Enter an email and a password with at least 10 characters.",
      });
    let u;
    if (req.params.mode === "register") {
      const salt = key();
      u = { id: key(), name: name || "Greeter", email: email.toLowerCase() };
      db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
        u.id,
        u.email,
        u.name,
        salt + ":" + hash(password, salt),
      );
    } else {
      u = db
        .prepare("SELECT * FROM users WHERE email=?")
        .get(email.toLowerCase());
      if (!u)
        return res
          .status(401)
          .json({ error: "Email or password is incorrect." });
      const [s, h] = String(u.password || "").split(":");
      if (!h)
        return res
          .status(401)
          .json({ error: "This account uses Google. Tap Continue with Google." });
      if (
        !timingSafeEqual(
          Buffer.from(h, "hex"),
          Buffer.from(hash(password, s), "hex"),
        )
      )
        return res
          .status(401)
          .json({ error: "Email or password is incorrect." });
    }
    const token = key();
    db.prepare("INSERT INTO sessions VALUES(?,?)").run(token, u.id);
    db.prepare("INSERT INTO session_expiry VALUES(?,?)").run(
      token,
      Date.now() + 7 * 86400000,
    );
    res.json({ token, user: { id: u.id, name: u.name, email: u.email } });
  } catch (e) {
    res.status(400).json({ error: "This email already has an account." });
  }
});
/* Continue with Google: the phone or browser gets a Google ID token, we check it
   with Google's public keys, then find or create the account by email. */
app.post("/api/auth/google", async (req, res) => {
  if (!GOOGLE_IDS.length) return res.status(503).json({ error: "Google sign-in isn’t set up yet." });
  let p;
  try {
    const ticket = await google.verifyIdToken({ idToken: String(req.body?.idToken || ""), audience: GOOGLE_IDS });
    p = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Google sign-in didn’t work. Try again." });
  }
  if (!p?.email || !p.email_verified) return res.status(401).json({ error: "Your Google email isn’t verified." });
  const email = p.email.toLowerCase();
  let u = db.prepare("SELECT id,name,email FROM users WHERE email=?").get(email);
  if (!u) {
    u = { id: key(), name: (p.name || p.given_name || "Greeter").slice(0, 80), email };
    db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(u.id, u.email, u.name, "google");
    if (p.picture && /^https:\/\//.test(p.picture))
      db.prepare("INSERT OR IGNORE INTO profiles VALUES(?,?)").run(u.id, JSON.stringify({ photo: p.picture }));
  }
  const token = key();
  db.prepare("INSERT INTO sessions VALUES(?,?)").run(token, u.id);
  db.prepare("INSERT INTO session_expiry VALUES(?,?)").run(token, Date.now() + 30 * 86400000);
  res.json({ token, user: { id: u.id, name: u.name, email: u.email } });
});
app.get("/api/me", (req, res) => {
  const u = user(req);
  res.status(u ? 200 : 401).json(u || { error: "Sign in to continue." });
});
const readProfile = (id) => {
  try {
    return JSON.parse(
      db.prepare("SELECT data FROM profiles WHERE user=?").get(id)?.data ||
        "{}",
    );
  } catch {
    return {};
  }
};
app.get("/api/profile", (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Sign in to continue." });
  const pw = db.prepare("SELECT password FROM users WHERE id=?").get(u.id)?.password || "";
  res.json({ ...readProfile(u.id), name: u.name, email: u.email, googleOnly: !pw.includes(":") });
});
app.post("/api/profile", (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Sign in to continue." });
  const body = req.body || {};
  const next = { ...readProfile(u.id) };
  for (const k of [
    "photo",
    "company",
    "phone",
    "language",
    "notifications",
    "board",
  ])
    if (body[k] !== undefined) next[k] = body[k];
  if (Array.isArray(body.vehicles))
    next.vehicles = body.vehicles.slice(0, 20).map((v) => ({
      id: String(v.id || key()).slice(0, 64),
      vehicle: String(v.vehicle || "").slice(0, 120),
      colour: String(v.colour || "").slice(0, 40),
      plate: String(v.plate || "").slice(0, 20),
      photo: String(v.photo || "").slice(0, 400000),
    }));
  const data = JSON.stringify(next);
  if (data.length > 2_000_000)
    return res
      .status(413)
      .json({ error: "Photos are too large. Try smaller ones." });
  if (typeof body.name === "string" && body.name.trim())
    db.prepare("UPDATE users SET name=? WHERE id=?").run(
      body.name.trim().slice(0, 80),
      u.id,
    );
  db.prepare("INSERT OR REPLACE INTO profiles VALUES(?,?)").run(u.id, data);
  const fresh = user(req);
  const pw = db.prepare("SELECT password FROM users WHERE id=?").get(u.id)?.password || "";
  res.json({ ...next, name: fresh.name, email: fresh.email, googleOnly: !pw.includes(":") });
});
/* GDPR right to erasure: delete the account and everything it owns. */
app.post("/api/account/delete", (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Sign in to continue." });
  const row = db.prepare("SELECT password FROM users WHERE id=?").get(u.id);
  const [salt, h] = String(row?.password || ":").split(":");
  const ok =
    (!h && req.body?.confirm === "DELETE") ||
    (typeof req.body?.password === "string" &&
    h &&
    timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(hash(req.body.password, salt), "hex")));
  if (!ok) return res.status(403).json({ error: "That password isn’t right." });
  const greets = db.prepare("SELECT id FROM greets WHERE owner=?").all(u.id);
  for (const { id } of greets) {
    for (const r of streams.get(id) || []) r.end();
    streams.delete(id);
    db.prepare("DELETE FROM subscriptions WHERE greet=?").run(id);
  }
  db.prepare("DELETE FROM greets WHERE owner=?").run(u.id);
  db.prepare("DELETE FROM subscriptions WHERE user=?").run(u.id);
  db.prepare("DELETE FROM profiles WHERE user=?").run(u.id);
  db.prepare("DELETE FROM resets WHERE user=?").run(u.id);
  for (const { token } of db.prepare("SELECT token FROM sessions WHERE user=?").all(u.id))
    db.prepare("DELETE FROM session_expiry WHERE token=?").run(token);
  db.prepare("DELETE FROM sessions WHERE user=?").run(u.id);
  db.prepare("DELETE FROM users WHERE id=?").run(u.id);
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(
    req.headers.authorization?.replace("Bearer ", "") || "",
  );
  res.json({ ok: true });
});
app.post("/api/auth/forgot", async (req, res) => {
  if (!process.env.SMTP_HOST)
    return res.status(503).json({
      error:
        "Password recovery requires the email service. Contact your administrator.",
    });
  const u = db
    .prepare("SELECT id FROM users WHERE email=?")
    .get(String(req.body.email || "").toLowerCase());
  if (u) {
    const token = key();
    db.prepare("INSERT INTO resets VALUES(?,?,?)").run(
      token,
      u.id,
      Date.now() + 30 * 60000,
    );
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || "Arigreet <support@arigreet.com>",
        to: req.body.email,
        subject: "Reset your Arigreet password",
        text: `Reset your password within 30 minutes: ${process.env.PUBLIC_URL || "http://localhost:3001"}/?reset=${token}`,
      });
    } catch (e) {
      return res.status(503).json({
        error: "Email service is unavailable. Please try again later.",
      });
    }
  }
  res.json({
    message: "If an account exists, a recovery email has been sent.",
  });
});
app.post("/api/auth/reset", (req, res) => {
  const r = db
    .prepare("SELECT * FROM resets WHERE token=? AND expires>?")
    .get(req.body.token || "", Date.now());
  if (!r || req.body.password?.length < 10)
    return res.status(400).json({
      error: "Invalid or expired reset link, or password is too short.",
    });
  const salt = key();
  db.prepare("UPDATE users SET password=? WHERE id=?").run(
    salt + ":" + hash(req.body.password, salt),
    r.user,
  );
  db.prepare("DELETE FROM sessions WHERE user=?").run(r.user);
  db.prepare("DELETE FROM resets WHERE user=?").run(r.user);
  res.json({ message: "Password updated. Sign in with your new password." });
});
app.get("/api/push/key", (req, res) => res.json({ key: vapidKeys.publicKey }));
/* Map tiles. OpenStreetMap's own servers are fine for development only; set
   MAPTILER_KEY (or MAP_TILES_URL + MAP_ATTRIBUTION) for production traffic. */
const mapConfig = () => {
  if (process.env.MAP_TILES_URL)
    return { url: process.env.MAP_TILES_URL, attribution: process.env.MAP_ATTRIBUTION || "© OpenStreetMap contributors" };
  if (process.env.MAPTILER_KEY)
    return {
      url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${encodeURIComponent(process.env.MAPTILER_KEY)}`,
      attribution: "© MapTiler © OpenStreetMap contributors",
    };
  return { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors", dev: true };
};
/* Android App Links: lets pickup links open the Arigreet app when it's installed.
   ANDROID_CERT_SHA256 = the SHA-256 fingerprint(s) from Play Console → App signing. */
app.get("/.well-known/assetlinks.json", (req, res) =>
  res.json(
    (process.env.ANDROID_CERT_SHA256 || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean).length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: "com.arigreet.app",
              sha256_cert_fingerprints: process.env.ANDROID_CERT_SHA256.split(",").map((v) => v.trim()).filter(Boolean),
            },
          },
        ]
      : [],
  ),
);
app.get("/api/config", (req, res) =>
  res.json({
    google: process.env.GOOGLE_WEB_CLIENT_ID || "",
    map: mapConfig(),
    legal: {
      name: process.env.LEGAL_NAME || "",
      address: process.env.LEGAL_ADDRESS || "",
      email: process.env.CONTACT_EMAIL || "",
      retentionDays,
    },
  }),
);
app.post("/api/push/subscribe", (req, res) => {
  const u = user(req);
  const g = req.body.greet ? load(req.body.greet) : null;
  if (!u && !access(req, g)) return res.sendStatus(403);
  // Native app: a Firebase registration token instead of a web push endpoint.
  if (req.body.native) {
    const token = String(req.body.native.token || "");
    if (!/^[\w:.-]{20,4096}$/.test(token)) return res.sendStatus(400);
    db.prepare("INSERT OR REPLACE INTO subscriptions VALUES(?,?,?,?)").run(
      "fcm:" + token,
      u?.id || null,
      g?.id || null,
      JSON.stringify({ fcm: token, platform: req.body.native.platform === "ios" ? "ios" : "android" }),
    );
    return res.json({ ok: true });
  }
  const subscription = req.body.subscription;
  let endpoint;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    return res.sendStatus(400);
  }
  if (
    endpoint.protocol !== "https:" ||
    ![
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
      "web.push.apple.com",
      "wns2-db5p.notify.windows.com",
    ].some(
      (d) => endpoint.hostname === d || endpoint.hostname.endsWith("." + d),
    )
  )
    return res.status(400).json({ error: "Push endpoint is unsupported." });
  db.prepare("INSERT OR REPLACE INTO subscriptions VALUES(?,?,?,?)").run(
    subscription.endpoint,
    u?.id || null,
    g?.id || null,
    JSON.stringify(subscription),
  );
  res.json({ ok: true });
});
app.get("/api/greets", (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Sign in to continue." });
  res.json(
    db
      .prepare("SELECT id FROM greets WHERE owner=?")
      .all(u.id)
      .map((r) => load(r.id)),
  );
});
app.post("/api/greets", (req, res) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Sign in to continue." });
  if (!req.body.name?.trim())
    return res.status(400).json({ error: "Passenger name is required." });
  const g = {
    ...greetFields(req.body),
    greeter: String(req.body.greeter || "").trim().slice(0, 120) || u.name,
    id: key(),
    owner: u.id,
    token: key(),
    state: "CREATED",
    created: Date.now(),
    expires: Date.now() + 7 * 86400000,
    locations: {},
    confirmations: [],
    timeline: [{ state: "CREATED", at: Date.now() }],
  };
  db.prepare("INSERT INTO greets VALUES(?,?,?,?)").run(
    g.id,
    u.id,
    g.token,
    JSON.stringify(g),
  );
  res.json(view(g));
});
const first = (n) =>
  String(n || "")
    .trim()
    .split(/\s+/)[0] || "Your guest";
app.get("/api/guest/:token", (req, res) => {
  const g = load(req.params.token);
  if (!g || g.token !== req.params.token)
    return res.status(404).json({ error: "This invitation is invalid." });
  if (g.expires < Date.now() && g.state !== "COMPLETED")
    return res.status(410).json({
      error: "This invitation has expired. Ask your greeter for a new link.",
    });
  if (g.state === "CANCELLED")
    return res.status(410).json({ error: "This Greet has been cancelled." });
  if (["CREATED", "INVITATION_SENT"].includes(g.state)) {
    g.state = "INVITATION_OPENED";
    g.timeline.push({ state: g.state, at: Date.now() });
    save(g);
    void push(g, "Arigreet", `${first(g.name)} opened your Greet`, "greeter");
  }
  res.json(view(g));
});
app.get("/api/greets/:id/events", (req, res) => {
  const g = load(req.params.id);
  if (!access(req, g)) return res.sendStatus(403);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(view(g))}\n\n`);
  if (!streams.has(g.id)) streams.set(g.id, new Set());
  streams.get(g.id).add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => {
    clearInterval(ping);
    streams.get(g.id)?.delete(res);
  });
});
const terminal = ["COMPLETED", "CANCELLED", "EXPIRED"];
const LIVE_STATES = ["PASSENGER_READY", "LIVE_GREET", "NEARBY", "VERY_CLOSE", "MEETING_CONFIRMATION"];
// If one person confirmed the meeting and the other forgot, close it after this.
const confirmTimeoutMs = Number(process.env.CONFIRM_TIMEOUT_MINUTES || 10) * 60000;
// Finished Greets (and everything in them) are deleted after this many days.
const retentionDays = Number(process.env.RETENTION_DAYS || 30);
const nearbyThreshold = Number(process.env.NEARBY_METRES || 30),
  closeThreshold = Number(process.env.VERY_CLOSE_METRES || 10);
const transitions = {
  CREATED: ["INVITATION_SENT", "LANDED", "PASSENGER_READY", "BAGGAGE_COLLECTION"],
  INVITATION_SENT: ["LANDED", "PASSENGER_READY", "BAGGAGE_COLLECTION"],
  INVITATION_OPENED: [
    "PASSENGER_CONFIRMED",
    "LANDED",
    "BAGGAGE_COLLECTION",
    "PASSENGER_READY",
  ],
  PASSENGER_CONFIRMED: ["LANDED", "BAGGAGE_COLLECTION", "PASSENGER_READY"],
  PRE_ARRIVAL: ["LANDED", "BAGGAGE_COLLECTION", "PASSENGER_READY"],
  FLIGHT_IN_PROGRESS: ["LANDED", "BAGGAGE_COLLECTION", "PASSENGER_READY"],
  LANDED: ["BAGGAGE_COLLECTION", "PASSENGER_READY"],
  BAGGAGE_COLLECTION: ["PASSENGER_READY"],
  PASSENGER_READY: ["LIVE_GREET", "MEETING_CONFIRMATION"],
  LIVE_GREET: ["NEARBY", "VERY_CLOSE", "MEETING_CONFIRMATION"],
  NEARBY: ["LIVE_GREET", "VERY_CLOSE", "MEETING_CONFIRMATION"],
  VERY_CLOSE: ["LIVE_GREET", "NEARBY", "MEETING_CONFIRMATION"],
  MEETING_CONFIRMATION: ["LIVE_GREET"],
};
app.post("/api/greets/:id/action", (req, res) => {
  const g = load(req.params.id);
  if (!access(req, g)) return res.sendStatus(403);
  // Optional guest rating after the pickup (spec §43).
  if (req.body.action === "rate") {
    const n = Number(req.body.value);
    if (g.state !== "COMPLETED" || !(n >= 1 && n <= 5)) return res.sendStatus(400);
    if (user(req)?.id === g.owner) return res.sendStatus(403);
    g.rating = Math.round(n);
    save(g);
    return res.json({ ok: true });
  }
  if (terminal.includes(g.state) || g.expires < Date.now())
    return res.status(409).json({ error: "This Greet has ended." });
  const role = user(req)?.id === g.owner ? "greeter" : "guest";
  const { action, value } = req.body;
  const previousState = g.state;
  if (action === "state" && ["NEARBY", "VERY_CLOSE"].includes(value))
    return res.status(409).json({
      error:
        "Use the meeting-point check-in; GPS alone cannot confirm you are very close.",
    });
  if (action === "state") {
    if (value === "CANCELLED" && role !== "greeter") return res.sendStatus(403);
    if (value !== "CANCELLED" && !transitions[g.state]?.includes(value))
      return res.status(409).json({ error: "This transition is unavailable." });
    if (role === "guest" && value === "INVITATION_SENT")
      return res.sendStatus(403);
    // "Not yet" from the meeting confirmation goes back to finding each other.
    if (g.state === "MEETING_CONFIRMATION" && value === "LIVE_GREET")
      g.confirmations = [];
    g.state = value;
    if (value === "PASSENGER_READY") g.readyAt = Date.now();
  } else if (action === "identify") {
    if (role !== "guest") return res.sendStatus(403);
    g.identification = {
      wearing: String(value?.wearing || "").slice(0, 300),
      bagDescription: String(value?.bagDescription || "").slice(0, 300),
      photo: /^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/.test(
        String(value?.photo || ""),
      )
        ? String(value.photo).slice(0, 400000)
        : "",
      other: String(value?.other || "").slice(0, 500),
      bags: Math.max(0, Math.min(20, Number(value?.bags) || 0)),
    };
  } else if (action === "edit") {
    if (
      role !== "greeter" ||
      ["LIVE_GREET", "NEARBY", "VERY_CLOSE", "MEETING_CONFIRMATION"].includes(
        g.state,
      )
    )
      return res
        .status(409)
        .json({ error: "This Greet cannot be edited during a live meeting." });
    if (!value?.name?.trim())
      return res.status(400).json({ error: "Passenger name is required." });
    Object.assign(g, greetFields(value));
  } else if (action === "location") {
    if (
      ![
        "PASSENGER_READY",
        "LIVE_GREET",
        "NEARBY",
        "VERY_CLOSE",
        "MEETING_CONFIRMATION",
      ].includes(g.state)
    )
      return res.sendStatus(409);
    if (
      !Number.isFinite(value?.latitude) ||
      Math.abs(value.latitude) > 90 ||
      !Number.isFinite(value.longitude) ||
      Math.abs(value.longitude) > 180 ||
      !Number.isFinite(value.accuracy) ||
      value.accuracy < 0
    )
      return res.sendStatus(400);
    g.locations[role] = { ...value, timestamp: Date.now() };
    if (g.stopped) delete g.stopped[role];
    if (
      g.locations.guest &&
      g.locations.greeter &&
      g.state === "PASSENGER_READY"
    )
      g.state = "LIVE_GREET";
  } else if (action === "meeting-point") {
    if (
      !["PASSENGER_READY", "LIVE_GREET", "NEARBY", "VERY_CLOSE"].includes(
        g.state,
      )
    )
      return res
        .status(409)
        .json({ error: "Let your greeter know you are ready first." });
    if (typeof value?.atPoint !== "boolean") return res.sendStatus(400);
    g[role === "guest" ? "meetingIntent" : "greeterIntent"] = {
      atPoint: value.atPoint,
      area: g.area,
      exit: g.exit,
      at: Date.now(),
    };
    if (!value.atPoint) g.state = "LIVE_GREET";
  } else if (action === "stop") {
    delete g.locations[role];
    // Spec §51: the other side sees that sharing was stopped on purpose.
    g.stopped = { ...(g.stopped || {}), [role]: Date.now() };
  } else if (action === "flash") {
    if (
      ![
        "PASSENGER_READY",
        "LIVE_GREET",
        "NEARBY",
        "VERY_CLOSE",
        "MEETING_CONFIRMATION",
      ].includes(g.state)
    )
      return res
        .status(409)
        .json({ error: "Start your meeting before using GreetBeacon." });
    if (role !== "guest") return res.sendStatus(403);
    if (Date.now() - (g.flashAt || 0) < 10000)
      return res
        .status(429)
        .json({ error: "Wait a few seconds before flashing again." });
    g.flashAt = Date.now();
  } else if (action === "presence") {
    // Greeter's one-tap status the passenger sees on her page.
    if (role !== "greeter") return res.sendStatus(403);
    if (!["ON_MY_WAY", "LATE_10", "LATE_20", "LATE_30", "AT_ARRIVALS"].includes(value))
      return res.sendStatus(400);
    g.greeterStatus = { code: value, at: Date.now() };
    if (value === "AT_ARRIVALS")
      g.greeterIntent = { atPoint: true, area: g.area, exit: g.exit, at: Date.now() };
  } else if (action === "help") {
    // Passenger can't find the greeter: alert him and light up his board.
    if (role !== "guest") return res.sendStatus(403);
    if (!["LANDED", "BAGGAGE_COLLECTION", ...LIVE_STATES].includes(g.state))
      return res.status(409).json({ error: "Tap I've landed first." });
    if (Date.now() - (g.helpAt || 0) < 15000)
      return res.status(429).json({ error: "Michael has been told. Give it a few seconds." });
    g.helpAt = Date.now();
    g.flashAt = Date.now();
  } else if (action === "confirm") {
    if (
      ![
        "PASSENGER_READY",
        "LIVE_GREET",
        "NEARBY",
        "VERY_CLOSE",
        "MEETING_CONFIRMATION",
      ].includes(g.state)
    )
      return res.status(409).json({
        error: "Your guest must be ready before confirming a meeting.",
      });
    g.confirmations = [...new Set([...g.confirmations, role])];
    if (g.confirmations.length === 1) g.confirmAt = Date.now();
    g.state =
      g.confirmations.length === 2 ? "COMPLETED" : "MEETING_CONFIRMATION";
    if (g.state === "COMPLETED") {
      g.completedAt = Date.now();
      g.locations = {};
    }
  } else return res.sendStatus(400);
  if (["location", "meeting-point"].includes(action))
    proximity(g, {
      nearbyMetres: nearbyThreshold,
      closeMetres: closeThreshold,
    });
  if (terminal.includes(g.state)) g.locations = {};
  if (g.timeline.at(-1)?.state !== g.state)
    g.timeline.push({ state: g.state, at: Date.now() });
  save(g);
  // Notifications (spec §46) — one per meaningful change, never spam.
  const guestName = first(g.name),
    greeterName = first(g.greeter);
  if (previousState !== g.state) {
    const toGreeter = {
      LANDED: `${guestName} has landed`,
      BAGGAGE_COLLECTION: `${guestName} is collecting baggage`,
      PASSENGER_READY: `${guestName} is ready`,
      NEARBY: `${guestName} is nearby`,
      COMPLETED: `Greet complete · ${g.name}`,
    }[g.state];
    if (toGreeter) void push(g, "Arigreet", toGreeter, "greeter");
    if (g.state === "NEARBY")
      void push(g, "Arigreet", `${greeterName} is nearby`, "guest");
  }
  if (action === "flash")
    void push(g, "Arigreet", `${guestName} flashed your GreetBoard`, "greeter");
  if (action === "help")
    void push(g, "Arigreet", `${guestName} can't find you. Hold up your GreetBoard.`, "greeter");
  if (action === "presence")
    void push(
      g,
      greeterName,
      {
        ON_MY_WAY: `${greeterName} is on the way to the airport`,
        LATE_10: `${greeterName} is running about 10 minutes late`,
        LATE_20: `${greeterName} is running about 20 minutes late`,
        LATE_30: `${greeterName} is running about 30 minutes late`,
        AT_ARRIVALS: `${greeterName} is at Arrivals with your name`,
      }[value],
      "guest",
    );
  if (action === "meeting-point" && role === "greeter" && value?.atPoint)
    void push(g, "Arigreet", `${greeterName} is at the meeting point`, "guest");
  res.json(view(g));
});
const flightPollMs = Math.max(
  60000,
  Number(process.env.FLIGHT_POLL_SECONDS || 300) * 1000,
);
const refreshes = new Map();
async function refreshFlight(id) {
  const before = load(id);
  if (!before || terminal.includes(before.state)) return;
  try {
    const flight = await fetchFlight(before);
    const current = load(id);
    if (
      !current ||
      terminal.includes(current.state) ||
      ["flight", "date", "airport", "airportCode", "airportTimezone"].some(
        (k) => current[k] !== before[k],
      )
    )
      return;
    const previousState = current.state;
    const notice = flightUpdate(current, flight, {
      thresholdMinutes: Number(process.env.FLIGHT_ALERT_MINUTES || 20),
    });
    if (previousState !== current.state)
      current.timeline.push({ state: current.state, at: Date.now() });
    save(current);
    if (notice) {
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: current.flightData.timezone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(
        new Date(
          current.flightData.estimated ||
            current.flightData.actual ||
            Date.now(),
        ),
      );
      await push(
        current,
        `${current.flight} · Flight update`,
        notice.type === "ETA"
          ? `Arrival is now estimated at ${time} (${Math.abs(notice.minutes)} minutes ${notice.minutes > 0 ? "later" : "earlier"}).`
          : notice.type === "LANDED"
            ? `${current.name}'s flight has landed.`
            : `Flight ${notice.type.toLowerCase()}. Review your pickup.`,
        true,
      );
    }
    return current;
  } catch (e) {
    const current = load(id);
    if (current && !terminal.includes(current.state)) {
      current.flightError = { message: e.message, at: Date.now() };
      save(current);
    }
    throw e;
  }
}
app.post("/api/greets/:id/flight-refresh", async (req, res) => {
  const g = load(req.params.id);
  if (!g || user(req)?.id !== g.owner) return res.sendStatus(403);
  if (!process.env.FLIGHTAWARE_API_KEY)
    return res.status(503).json({
      error:
        "Flight updates require a FlightAware API key. Your manual details remain available.",
    });
  if (terminal.includes(g.state))
    return res.status(409).json({ error: "This Greet has ended." });
  if (Date.now() - (refreshes.get(g.id) || 0) < 60000)
    return res
      .status(429)
      .json({ error: "Flight was refreshed recently. Please wait a minute." });
  refreshes.set(g.id, Date.now());
  try {
    res.json((await refreshFlight(g.id)) || load(g.id));
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});
let flightPolling = false;
async function pollFlights() {
  if (!process.env.FLIGHTAWARE_API_KEY || flightPolling) return;
  flightPolling = true;
  try {
    const rows = db.prepare("SELECT id FROM greets").all();
    for (const row of rows) {
      const g = load(row.id);
      const date = Date.parse(g.date + "T00:00:00Z");
      if (
        terminal.includes(g.state) ||
        !g.flight ||
        !Number.isFinite(date) ||
        Math.abs(Date.now() - date) > 2 * 86400000 ||
        Date.now() - (refreshes.get(g.id) || 0) < flightPollMs
      )
        continue;
      refreshes.set(g.id, Date.now());
      await refreshFlight(g.id).catch(() => {});
    }
  } finally {
    flightPolling = false;
  }
}
setInterval(pollFlights, flightPollMs).unref();
void pollFlights();
setInterval(() => {
  for (const row of db.prepare("SELECT id FROM greets").all()) {
    const g = load(row.id);
    const endedAt = terminal.includes(g.state) ? g.completedAt || g.timeline.at(-1)?.at || 0 : 0;
    if (endedAt && Date.now() - endedAt > retentionDays * 86400000) {
      db.prepare("DELETE FROM subscriptions WHERE greet=?").run(g.id);
      db.prepare("DELETE FROM greets WHERE id=?").run(g.id);
      continue;
    }
    if (!terminal.includes(g.state) && g.expires < Date.now()) {
      g.state = "EXPIRED";
      g.locations = {};
      g.timeline.push({ state: "EXPIRED", at: Date.now() });
      save(g);
    } else if (g.state === "MEETING_CONFIRMATION" && g.confirmAt && Date.now() - g.confirmAt > confirmTimeoutMs) {
      g.state = "COMPLETED";
      g.completedAt = Date.now();
      g.autoCompleted = true;
      g.locations = {};
      g.timeline.push({ state: "COMPLETED", at: Date.now() });
      save(g);
    } else if (terminal.includes(g.state) && Object.keys(g.locations).length) {
      g.locations = {};
      save(g);
    } else if (!terminal.includes(g.state)) {
      const previous = g.state;
      proximity(g, {
        nearbyMetres: nearbyThreshold,
        closeMetres: closeThreshold,
      });
      if (previous !== g.state) {
        g.timeline.push({ state: g.state, at: Date.now() });
        save(g);
      }
    }
  }
}, 60000).unref();
// arigreet.com: the public website (home, keyword pages, airport guides) lives
// at the root; the app itself opens at /app.
app.use(
  express.static("website/dist", {
    extensions: ["html"],
    setHeaders: (res, file) => {
      if (file.endsWith(".html")) res.set("Cache-Control", "public, max-age=600");
    },
  }),
);
app.get("/app", (req, res) => res.sendFile(path.resolve("dist/index.html")));
app.use(express.static("dist", { index: false }));
// Passenger links get a real preview in WhatsApp, iMessage and SMS:
// who is meeting them and where, so the link doesn't look like spam.
const htmlEscape = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
app.get("/g/:token", (req, res, next) => {
  const g = load(req.params.token);
  if (!g || g.token !== req.params.token) return next();
  let html;
  try {
    html = readFileSync(path.resolve("dist/index.html"), "utf8");
  } catch {
    return next();
  }
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const who = String(g.greeter || "Your greeter").trim();
  const place = String(g.airport || "the airport").replace(/\s*\(.*\)/, "");
  const when = [g.date && new Date(g.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), g.time]
    .filter(Boolean)
    .join(" · ");
  const title = `${who} is meeting you at ${place} Airport`;
  const desc = `${when ? when + " · " : ""}Open this link when you land. No app needed.`;
  const image = /^https:\/\//.test(g.greeterPhoto || "") ? g.greeterPhoto : `${base}/icon-512.png`;
  const meta = [
    ["og:type", "website"],
    ["og:site_name", "Arigreet"],
    ["og:title", title],
    ["og:description", desc],
    ["og:image", image],
    ["og:url", `${base}/g/${g.token}`],
    ["twitter:card", "summary"],
  ]
    .map(([k, v]) => `<meta property="${k}" content="${htmlEscape(v)}" />`)
    .join("\n    ");
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${htmlEscape(title)}</title>`)
    .replace("</head>", `    <meta name="description" content="${htmlEscape(desc)}" />\n    ${meta}\n    <meta name="robots" content="noindex" />\n  </head>`);
  res.set("Cache-Control", "no-store").type("html").send(html);
});
app.get("/{*path}", (req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
app.listen(process.env.PORT || 3001, "0.0.0.0", () =>
  console.log("Arigreet running on http://localhost:3001"),
);
