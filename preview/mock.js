/* In-page Arigreet backend for the phone preview.
   Mirrors server.js closely enough to walk the whole journey, and plays
   the other person (passenger or greeter) so one phone can show both sides. */
import { proximity } from "../lib/proximity.js";

window.__ARIGREET_PREVIEW__ = true;

// Storage can be blocked in sandboxed previews; fall back to memory.
(() => {
  try {
    localStorage.setItem("__t", "1");
    localStorage.removeItem("__t");
  } catch {
    const m = new Map();
    const mem = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      clear: () => m.clear(),
      key: (i) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    };
    Object.defineProperty(window, "localStorage", { value: mem, configurable: true });
  }
})();

const hex = (n = 48) => Array.from(crypto.getRandomValues(new Uint8Array(n / 2)), (b) => b.toString(16).padStart(2, "0")).join("");
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "Your guest";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Athens arrivals hall, Exit 3
export const POINT = { latitude: 37.93655, longitude: 23.94468 };
const move = (from, to, metres) => {
  const dLat = (to.latitude - from.latitude) * 111320;
  const dLng = (to.longitude - from.longitude) * 111320 * Math.cos((to.latitude * Math.PI) / 180);
  const d = Math.hypot(dLat, dLng);
  if (d <= metres) return { ...to };
  const f = metres / d;
  return { latitude: from.latitude + (to.latitude - from.latitude) * f, longitude: from.longitude + (to.longitude - from.longitude) * f };
};
const offset = (p, north, east) => ({
  latitude: p.latitude + north / 111320,
  longitude: p.longitude + east / (111320 * Math.cos((p.latitude * Math.PI) / 180)),
});

let db;
export function resetDb() {
  const owner = "u-demo";
  const token = "5e1f0c9a7b3d2e4f6a8b0c1d2e3f4a5b6c7d8e9f0a1b2c3d";
  db = {
    users: { [owner]: { id: owner, name: "Michael Collins", email: "michael@elite.example" } },
    sessions: {},
    profiles: {},
    greets: {
      "g-demo": {
        id: "g-demo", owner, token, state: "INVITATION_SENT",
        name: "Helen Johnson", greeter: "Michael Collins", company: "Elite Transfers",
        contact: "+30 690 000 0000", allowCall: true,
        flight: "A3 123", date: today(), time: hhmm(Date.now() - 15 * 60000),
        airport: "Athens (ATH)", airportCode: "ATH", terminal: "Main Terminal",
        area: "Arrivals Hall", exit: "Exit 3", landmark: "Information desk",
        instructions: "I’ll be beside the information desk holding your GreetBoard.",
        vehicle: "Mercedes E-Class", colour: "Black", plate: "ABC-1234",
        theme: "Signature", beacon: "Klein Blue", boardOrientation: "Portrait", boardName: "Full name", boardShowFlight: true,
        flightData: { status: "Landed", actual: new Date(Date.now() - 12 * 60000).toISOString() },
        created: Date.now(), expires: Date.now() + 7 * 86400000,
        locations: {}, confirmations: [],
        timeline: [{ state: "CREATED", at: Date.now() - 3600000 }, { state: "INVITATION_SENT", at: Date.now() - 3500000 }],
      },
    },
  };
  sim.clear();
}
export const demoToken = () => db.greets["g-demo"].token;
export const latestGuestToken = (owner) => {
  const mine = Object.values(db.greets).filter((g) => g.owner === owner && !["CANCELLED", "COMPLETED"].includes(g.state)).sort((a, b) => b.created - a.created);
  return (mine[0] || db.greets["g-demo"]).token;
};
export const sessionOwner = (token) => db.sessions[token];

/* Live updates */
const subs = new Map();
const emit = (g) => subs.get(g.id)?.forEach((fn) => fn(structuredClone(g)));
class MockEventSource {
  constructor(url) {
    this.id = url.split("/")[3];
    this.fn = (g) => this.onmessage?.({ data: JSON.stringify(g) });
    if (!subs.has(this.id)) subs.set(this.id, new Set());
    subs.get(this.id).add(this.fn);
    setTimeout(() => this.onopen?.(), 0);
  }
  close() {
    subs.get(this.id)?.delete(this.fn);
  }
}
window.EventSource = MockEventSource;

/* Location: your phone sits at the meeting point. */
navigator.__proto__ &&
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition(ok) {
        const id = setInterval(() => ok(fix()), 2500);
        setTimeout(() => ok(fix()), 300);
        return id;
      },
      clearWatch: (id) => clearInterval(id),
      getCurrentPosition: (ok) => setTimeout(() => ok(fix()), 300),
    },
  });
const fix = () => ({ coords: { ...offset(POINT, 2, 1), accuracy: 3 }, timestamp: Date.now() });
Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });

const terminal = ["COMPLETED", "CANCELLED", "EXPIRED"];
const LIVE = ["PASSENGER_READY", "LIVE_GREET", "NEARBY", "VERY_CLOSE", "MEETING_CONFIRMATION"];
const transitions = {
  CREATED: ["INVITATION_SENT", "LANDED", "PASSENGER_READY", "BAGGAGE_COLLECTION"],
  INVITATION_SENT: ["LANDED", "PASSENGER_READY", "BAGGAGE_COLLECTION"],
  INVITATION_OPENED: ["PASSENGER_CONFIRMED", "LANDED", "BAGGAGE_COLLECTION", "PASSENGER_READY"],
  PASSENGER_CONFIRMED: ["LANDED", "BAGGAGE_COLLECTION", "PASSENGER_READY"],
  LANDED: ["BAGGAGE_COLLECTION", "PASSENGER_READY"],
  BAGGAGE_COLLECTION: ["PASSENGER_READY"],
  PASSENGER_READY: ["LIVE_GREET", "MEETING_CONFIRMATION"],
  LIVE_GREET: ["NEARBY", "VERY_CLOSE", "MEETING_CONFIRMATION"],
  NEARBY: ["LIVE_GREET", "VERY_CLOSE", "MEETING_CONFIRMATION"],
  VERY_CLOSE: ["LIVE_GREET", "NEARBY", "MEETING_CONFIRMATION"],
  MEETING_CONFIRMATION: ["LIVE_GREET"],
};

function commit(g) {
  if (terminal.includes(g.state)) g.locations = {};
  if (g.timeline.at(-1)?.state !== g.state) g.timeline.push({ state: g.state, at: Date.now() });
  emit(g);
  sim.kick(g);
}

/* One action, as server.js handles it. Returns [status, body]. */
function act(g, role, action, value) {
  if (action === "rate") {
    if (g.state !== "COMPLETED") return [400, {}];
    g.rating = value;
    return [200, { ok: true }];
  }
  if (terminal.includes(g.state)) return [409, { error: "This Greet has ended." }];
  if (action === "state") {
    if (value === "CANCELLED" && role !== "greeter") return [403, {}];
    if (value !== "CANCELLED" && !transitions[g.state]?.includes(value)) return [409, { error: "This transition is unavailable." }];
    if (g.state === "MEETING_CONFIRMATION" && value === "LIVE_GREET") g.confirmations = [];
    g.state = value;
    if (value === "PASSENGER_READY") g.readyAt = Date.now();
  } else if (action === "identify") {
    g.identification = { ...value };
  } else if (action === "edit") {
    Object.assign(g, value);
  } else if (action === "location") {
    if (!LIVE.includes(g.state)) return [409, {}];
    g.locations[role] = { ...value, timestamp: Date.now() };
    if (g.stopped) delete g.stopped[role];
    if (g.locations.guest && g.locations.greeter && g.state === "PASSENGER_READY") g.state = "LIVE_GREET";
  } else if (action === "meeting-point") {
    g[role === "guest" ? "meetingIntent" : "greeterIntent"] = { atPoint: value.atPoint, at: Date.now() };
    if (!value.atPoint) g.state = "LIVE_GREET";
  } else if (action === "stop") {
    delete g.locations[role];
    g.stopped = { ...(g.stopped || {}), [role]: Date.now() };
  } else if (action === "flash") {
    if (Date.now() - (g.flashAt || 0) < 10000) return [429, { error: "Wait a few seconds before flashing again." }];
    g.flashAt = Date.now();
  } else if (action === "presence") {
    g.greeterStatus = { code: value, at: Date.now() };
    if (value === "AT_ARRIVALS") g.greeterIntent = { atPoint: true, at: Date.now() };
  } else if (action === "help") {
    if (Date.now() - (g.helpAt || 0) < 15000) return [429, { error: "Michael has been told. Give it a few seconds." }];
    g.helpAt = Date.now();
    g.flashAt = Date.now();
  } else if (action === "confirm") {
    g.confirmations = [...new Set([...g.confirmations, role])];
    g.state = g.confirmations.length === 2 ? "COMPLETED" : "MEETING_CONFIRMATION";
    if (g.state === "COMPLETED") g.completedAt = Date.now();
  } else return [400, {}];
  if (["location", "meeting-point"].includes(action) && g.state !== "MEETING_CONFIRMATION") proximity(g);
  commit(g);
  return [200, g];
}

/* The other person. `viewer` is who is holding the phone. */
export const sim = {
  viewer: "greeter",
  timers: new Set(),
  walkers: new Map(),
  seen: new Set(),
  clear() {
    this.seen.clear();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.walkers.forEach(clearInterval);
    this.walkers.clear();
  },
  later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  },
  other() {
    return this.viewer === "greeter" ? "guest" : "greeter";
  },
  kick(g) {
    const them = this.other();
    const key = g.id + g.state + them;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (them === "guest") {
      // Greeter is holding the phone; the passenger lands and walks out.
      if (["CREATED", "INVITATION_SENT"].includes(g.state)) this.later(g.state === "CREATED" ? 7000 : 3500, () => {
        g.state = "INVITATION_OPENED";
        commit(g);
      });
      if (g.state === "INVITATION_OPENED") this.later(4000, () => act(g, "guest", "state", "LANDED"));
      if (g.state === "LANDED") this.later(3500, () => act(g, "guest", "state", "BAGGAGE_COLLECTION"));
      if (g.state === "BAGGAGE_COLLECTION") this.later(9000, () => {
        act(g, "guest", "state", "PASSENGER_READY");
        this.walk(g, "guest");
      });
    } else {
      // Passenger is holding the phone; the greeter walks to the meeting point.
      if (["INVITATION_OPENED", "INVITATION_SENT"].includes(g.state)) this.later(2500, () => act(g, "greeter", "presence", "ON_MY_WAY"));
      if (["LANDED", "BAGGAGE_COLLECTION"].includes(g.state)) this.later(2500, () => act(g, "greeter", "presence", "AT_ARRIVALS"));
      if (g.state === "PASSENGER_READY") this.walk(g, "greeter");
    }
    if (g.state === "VERY_CLOSE" && them === "guest") this.later(2500, () => act(g, "guest", "flash"));
    if (g.state === "MEETING_CONFIRMATION" && !g.confirmations.includes(them)) this.later(2200, () => act(g, them, "confirm"));
  },
  // Start ~240 m away and walk toward the meeting point.
  walk(g, who) {
    if (this.walkers.has(g.id)) return;
    let p = offset(POINT, 190, -150);
    const step = () => {
      if (!LIVE.includes(g.state) || g.state === "MEETING_CONFIRMATION") return;
      const target = g.locations[who === "guest" ? "greeter" : "guest"] || POINT;
      p = move(p, target, 22);
      act(g, who, "location", { ...p, accuracy: 3 });
    };
    step();
    this.walkers.set(g.id, setInterval(step, 2400));
  },
};

/* fetch("/api/…") */
const realFetch = window.fetch.bind(window);
const reply = (status, body) =>
  new Response(JSON.stringify(body ?? {}), { status, headers: { "Content-Type": "application/json" } });
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith("/data/airports.json") && window.__AIRPORTS) return reply(200, window.__AIRPORTS);
  if (!url.startsWith("/api")) return realFetch(input, init);
  await new Promise((r) => setTimeout(r, 120));
  const path = url.replace(/^\/api/, "").split("?")[0];
  const body = init.body ? JSON.parse(init.body) : {};
  const h = init.headers || {};
  const uid = db.sessions[(h.Authorization || "").replace("Bearer ", "")];
  const u = uid && db.users[uid];
  const guestTok = h["X-Guest-Token"];
  const out = (s, b) => reply(s, structuredClone(b));
  let m;
  if ((m = path.match(/^\/auth\/(login|register)$/))) {
    if (!body.email || !body.password || body.password.length < 10)
      return out(400, { error: "Enter an email and a password with at least 10 characters." });
    let user = Object.values(db.users).find((x) => x.email === body.email.toLowerCase());
    if (m[1] === "register") {
      if (user) return out(400, { error: "This email already has an account." });
      user = { id: hex(16), name: body.name || "Greeter", email: body.email.toLowerCase() };
      db.users[user.id] = user;
    } else if (!user) return out(401, { error: "Email or password is incorrect." });
    const token = hex(32);
    db.sessions[token] = user.id;
    return out(200, { token, user });
  }
  if (path === "/auth/forgot" || path === "/auth/reset" || path === "/logout") return out(200, { ok: true });
  if (path === "/push/key") return out(404, {});
  if (path === "/config") return out(200, { map: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" }, legal: {} });
  if (path === "/me") return u ? out(200, u) : out(401, { error: "Sign in to continue." });
  if (path === "/profile") {
    if (!u) return out(401, { error: "Sign in to continue." });
    if (init.body) {
      db.profiles[u.id] = { ...db.profiles[u.id], ...body };
      if (body.name?.trim()) u.name = body.name.trim();
    }
    return out(200, { ...db.profiles[u.id], name: u.name, email: u.email });
  }
  if (path === "/greets") {
    if (!u) return out(401, { error: "Sign in to continue." });
    if (!init.body) return out(200, Object.values(db.greets).filter((g) => g.owner === u.id));
    if (!body.name?.trim()) return out(400, { error: "Passenger name is required." });
    const g = {
      ...body, greeter: body.greeter?.trim() || u.name, id: hex(16), owner: u.id, token: hex(48), state: "CREATED",
      created: Date.now(), expires: Date.now() + 7 * 86400000,
      locations: {}, confirmations: [], timeline: [{ state: "CREATED", at: Date.now() }],
    };
    db.greets[g.id] = g;
    sim.kick(g);
    return out(200, g);
  }
  if ((m = path.match(/^\/guest\/([a-f0-9]+)$/))) {
    const g = Object.values(db.greets).find((x) => x.token === m[1]);
    if (!g) return out(404, { error: "This invitation is invalid." });
    if (g.state === "CANCELLED") return out(410, { error: "This Greet has been cancelled." });
    if (["CREATED", "INVITATION_SENT"].includes(g.state)) {
      g.state = "INVITATION_OPENED";
      commit(g);
    }
    return out(200, g);
  }
  if ((m = path.match(/^\/greets\/([^/]+)\/(action|flight-refresh)$/))) {
    const g = db.greets[m[1]];
    if (!g) return out(404, {});
    if (m[2] === "flight-refresh") return out(200, g);
    const role = u && u.id === g.owner ? "greeter" : guestTok === g.token ? "guest" : null;
    if (!role) return out(403, {});
    const [s, b] = act(g, role, body.action, body.value);
    return out(s, b);
  }
  return out(404, { error: "Not found" });
};

resetDb();
