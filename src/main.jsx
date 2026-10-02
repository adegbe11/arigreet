import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./design.css";
import "./app.css";
import "./ios27.css";
import Welcome, { FlashPreview } from "./Welcome.jsx";
import CreateFlow from "./CreateFlow.jsx";
import Greeter from "./Greeter.jsx";
import Guest from "./Guest.jsx";
import Board from "./Board.jsx";
import Sheets from "./Sheets.jsx";
import Legal from "./Legal.jsx";
import Finder from "./Finder.jsx";
import { loadAirports } from "./AirportPicker.jsx";
import { TERMINALS } from "./terminals.js";
import { translate, pickLang } from "./i18n.js";
import { isNative, platform, nativePushToken, nativeSetup, haptic } from "./native.js";
import { AppCtx, ConnectionBanner, LIVE, ENDED, localDate, first } from "./ui.jsx";
import { saveGreeter, readGreeter, clearGreeter } from "./greeter-cache.js";
import {
  savePickup,
  readPickup,
  clearPickup,
  cachePickupPhotos,
} from "./guest-cache.js";

/* Greet defaults. The greeter's profile fills in their name, photo,
   company, phone, board style and saved vehicle. */
const blankGreet = () => ({
  name: "",
  phone: "",
  email: "",
  photo: "",
  language: "English",
  flight: "",
  date: localDate(),
  airport: "",
  airportCode: "",
  airportTimezone: "",
  airportFull: "",
  airportLat: null,
  airportLng: null,
  terminal: "",
  time: "",
  area: "Arrivals Hall",
  exit: "",
  landmark: "",
  instructions: "",
  greeter: "",
  greeterPhoto: "",
  company: "",
  companyLogo: "",
  contact: "",
  allowCall: true,
  vehicle: "",
  colour: "",
  plate: "",
  vehiclePhoto: "",
  passengers: 1,
  bags: 1,
  theme: "Signature",
  beacon: "Klein Blue",
  boardOrientation: "Portrait",
  boardName: "Full name",
});
const LIVE_STATES = LIVE;

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("arigreet-session") || "null");
    } catch {
      return null;
    }
  });
  const guestToken = window.__arigreetGuest
    ? window.__arigreetGuest
    : location.pathname.startsWith("/g/")
    ? location.pathname.split("/")[2]
    : null;
  const isGuest = !!guestToken;
  const role = isGuest ? "guest" : "greeter";
  const [page, setPage] = useState("home");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const [greets, setGreets] = useState([]);
  const [g, setG] = useState(null);
  const [profile, setProfile] = useState(null);
  const [modal, setModal] = useState(
    new URLSearchParams(location.search).has("reset") ? "reset" : null,
  );
  useEffect(() => {
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(g?.state) && ["board", "confirm", "meeting"].includes(modal))
      setModal(null);
  }, [g?.state, modal]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  /* Passenger screens speak the passenger's language; the greeter app is English. */
  const [lang, setLangState] = useState(() => (guestToken ? pickLang() : "en"));
  const setLang = (l) => {
    try {
      localStorage.setItem("arigreet-lang", l);
    } catch {}
    setLangState(l);
  };
  const t = (str, vars) => translate(lang, str, vars);
  // Someone reopening their link at the airport goes straight to their pickup.
  const [guestView, setGuestViewState] = useState(() => {
    try {
      return guestToken && localStorage.getItem("arigreet-opened-" + guestToken) ? "details" : "welcome";
    } catch {
      return "welcome";
    }
  });
  const setGuestView = (v) => {
    if (v !== "welcome" && guestToken)
      try {
        localStorage.setItem("arigreet-opened-" + guestToken, "1");
      } catch {}
    setGuestViewState(v);
  };
  const [guestFail, setGuestFail] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [sharing, setSharing] = useState(false);
  const [offlinePickup, setOfflinePickup] = useState(false);
  const [noSignal, setNoSignal] = useState(false);
  const [retry, setRetry] = useState(0);
  const fromServer = useRef(false); // true once Greets came from the server, so only real data is saved
  const [cachedAt, setCachedAt] = useState(null);
  // The welcome screen is a first-launch moment. Once someone taps Get Started
  // (or signs in) the app opens on Home from then on.
  const STARTED = "arigreet-started";
  const [welcome, setWelcomeState] = useState(() => {
    if (session) return false;
    try {
      return !localStorage.getItem(STARTED);
    } catch {
      return true;
    }
  });
  const setWelcome = (on) => {
    if (!on)
      try {
        localStorage.setItem(STARTED, "1");
      } catch {}
    setWelcomeState(on);
  };
  const [replayIntro, setReplayIntro] = useState(false);
  const [flow, setFlow] = useState(null);
  const [flashPreview, setFlashPreview] = useState(
    () => new URLSearchParams(location.search).get("preview") === "flash",
  );
  const [mediaCount, setMediaCount] = useState(null);
  const watch = useRef(null);

  useEffect(() => {
    if (!isGuest || !("serviceWorker" in navigator)) return;
    const listener = (event) => {
      if (event.data?.type === "PICKUP_MEDIA_READY" && event.data.token === guestToken)
        setMediaCount(event.data.count);
    };
    navigator.serviceWorker.addEventListener("message", listener);
    return () => navigator.serviceWorker.removeEventListener("message", listener);
  }, []);
  const pickupPhoto = (item, which) => {
    const key = which === "greeter" ? "greeterPhoto" : "vehiclePhoto";
    if (!item?.[key]) return "";
    if (item[key].startsWith("data:image/")) return item[key];
    return isGuest && (offlinePickup || mediaCount > 0)
      ? "/pickup-media/" + guestToken + "/" + which
      : item[key];
  };

  async function api(url, body, tokenOverride) {
    const res = await fetch("/api" + url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(tokenOverride || (session && !isGuest)
          ? { Authorization: "Bearer " + (tokenOverride || session.token) }
          : {}),
        ...(guestToken ? { "X-Guest-Token": guestToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res
      .json()
      .catch(() => ({ error: "Connection unavailable. Please try again." }));
    if (!res.ok) {
      if (res.status === 401 && session && !isGuest && !tokenOverride) {
        localStorage.removeItem("arigreet-session");
        clearGreeter(localStorage);
        setSession(null);
      }
      const e = Error(data.error || "This action is unavailable.");
      e.status = res.status;
      throw e;
    }
    return data;
  }
  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function enableNotifications() {
    if (isNative) {
      const token = await nativePushToken();
      await api("/push/subscribe", { native: { token, platform }, greet: isGuest ? g.id : undefined });
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window))
      throw Error("Notifications aren’t available in this browser. Add Arigreet to your Home Screen first.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error("Notifications are off. You can turn them on in your phone’s settings.");
    const registration = await navigator.serviceWorker.ready;
    const { key } = await api("/push/key");
    const padding = "=".repeat((4 - (key.length % 4)) % 4);
    const bytes = Uint8Array.from(
      atob((key + padding).replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      }));
    await api("/push/subscribe", {
      subscription: subscription.toJSON(),
      greet: isGuest ? g.id : undefined,
    });
  }
  useEffect(() => {
    // The app has its screens built in; the service worker is for the website.
    if ("serviceWorker" in navigator && !isNative)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
  }, []);
  function stopLocal() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
  }
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      stopLocal();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    const fast = LIVE_STATES.includes(g?.state) || modal === "board" || modal === "finder";
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 30000);
    return () => clearInterval(t);
  }, [g?.id, g?.state, modal]);

  /* Load: guest pickup (with offline fallback) or the greeter's Greets + profile */
  useEffect(() => {
    if (isGuest)
      run(async () => {
        const cached = readPickup(localStorage, guestToken);
        const offline = () => {
          stopLocal();
          setG({
            ...cached.pickup,
            token: guestToken,
            state: "OFFLINE_PICKUP",
            locations: {},
            confirmations: [],
            messages: [],
            timeline: [],
          });
          setOfflinePickup(true);
          setCachedAt(cached.cachedAt);
          setGuestView("details");
        };
        if (cached && !navigator.onLine) return offline();
        try {
          const next = await api("/guest/" + guestToken);
          setG(next);
          setGuestFail(null);
          setOfflinePickup(false);
        } catch (e) {
          if (e.status) {
            clearPickup(localStorage, guestToken);
            navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PICKUP_MEDIA", token: guestToken });
            setG(null);
            setGuestFail({ status: e.status, message: e.message });
            return;
          }
          if (!cached) {
            setGuestFail({ status: 0, message: e.message });
            return;
          }
          offline();
        }
      });
    else if (session) {
      // No signal at the airport: open the saved copy so the GreetBoard still works.
      const saved = () => {
        const c = readGreeter(localStorage, session.user?.id);
        if (!c) return false;
        setGreets(c.greets);
        if (c.profile) setProfile((p) => p || c.profile);
        setNoSignal(true);
        return true;
      };
      if (!navigator.onLine && saved()) return;
      (async () => {
        try {
          const [list, prof] = await Promise.all([api("/greets"), api("/profile").catch(() => null)]);
          fromServer.current = true;
          setGreets(list);
          setProfile(prof);
          setNoSignal(false);
        } catch (e) {
          if (e.status || !saved()) setError(e.message);
        }
      })();
    }
    else {
      setGreets([]);
      setProfile(null);
    }
  }, [session, online, retry]);

  useEffect(() => {
    if (!isGuest || !g || offlinePickup) return;
    try {
      const entry = savePickup(localStorage, guestToken, g);
      setCachedAt(entry?.cachedAt || null);
      if (entry) void cachePickupPhotos(localStorage, guestToken).catch(() => {});
    } catch {}
    if (!("serviceWorker" in navigator) || isNative) return;
    const cacheMedia = () =>
      navigator.serviceWorker.ready
        .then((reg) => {
          const worker = navigator.serviceWorker.controller || reg.active;
          worker?.postMessage({
            type: ENDED.includes(g.state) ? "CLEAR_PICKUP_MEDIA" : "CACHE_PICKUP_MEDIA",
            token: guestToken,
            urls: [
              { role: "greeter", url: g.greeterPhoto },
              { role: "vehicle", url: g.vehiclePhoto },
            ].filter((v) => v.url && !v.url.startsWith("data:")),
            expires: Math.min(g.expires || Date.now() + 86400000, Date.now() + 86400000),
          });
        })
        .catch(() => {});
    cacheMedia();
    navigator.serviceWorker.addEventListener("controllerchange", cacheMedia);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", cacheMedia);
  }, [g, isGuest, offlinePickup]);

  /* Poor internet (spec §51) */
  useEffect(() => {
    const c = navigator.connection;
    if (!c) return;
    const check = () => {
      if (["slow-2g", "2g"].includes(c.effectiveType) || c.rtt > 1500)
        setError(t("Your connection is slow. Updates may take a moment."));
    };
    check();
    c.addEventListener?.("change", check);
    return () => c.removeEventListener?.("change", check);
  }, []);

  /* Live updates for the open Greet */
  const lastState = useRef(null);
  useEffect(() => {
    lastState.current = g?.state || null;
    if (!g || offlinePickup) return;
    const es = new EventSource("/api/greets/" + g.id + "/events?token=" + g.token);
    es.onmessage = (e) => {
      const next = JSON.parse(e.data);
      setG((prev) => {
        // Spec §51: tell the passenger when the pickup details change under them.
        if (isGuest && prev && prev.id === next.id) {
          const moved = ["area", "exit", "landmark", "instructions"].some((k) => (prev[k] || "") !== (next[k] || ""));
          const car = ["vehicle", "colour", "plate"].some((k) => (prev[k] || "") !== (next[k] || ""));
          const time = prev.time !== next.time || prev.date !== next.date;
          const who = next.greeter ? next.greeter.trim().split(" ")[0] : "Your greeter";
          if (moved) setError(t("{peer} changed the meeting point to {place}.", { peer: who, place: [next.area, next.exit].filter(Boolean).join(" · ") }));
          else if (car) setError(t("{peer} updated the vehicle details.", { peer: who }));
          else if (time) setError(t("{peer} updated the pickup time.", { peer: who }));
        }
        return next;
      });
      setGreets((v) => v.map((x) => (x.id === next.id ? next : x)));
      if (next.state !== lastState.current && lastState.current) haptic("success");
      lastState.current = next.state;
    };
    const lost = t("Live connection interrupted. Reconnecting…");
    es.onerror = () => setError(lost);
    es.onopen = () => setError((m) => (m === lost ? "" : m));
    return () => es.close();
  }, [g?.id, offlinePickup]);
  useEffect(() => {
    if (g && ENDED.includes(g.state)) stopLocal();
  }, [g?.state]);

  /* GreetBeacon: the guest flashed — vibrate, open the board, optional chime (spec §38) */
  const lastFlash = useRef(g?.flashAt || 0);
  useEffect(() => {
    if (isGuest || !g?.flashAt || g.flashAt === lastFlash.current) return;
    lastFlash.current = g.flashAt;
    if (Date.now() - g.flashAt > 8000) return;
    if (isNative) haptic("warning");
    else navigator.vibrate?.([180, 100, 180, 100, 180]);
    setPage("detail");
    setModal("board");
    if (profile?.notifications?.sound)
      try {
        const ctx = new AudioContext();
        [0, 0.18].forEach((d, i) => {
          const o = ctx.createOscillator();
          const v = ctx.createGain();
          o.frequency.value = i ? 880 : 660;
          v.gain.setValueAtTime(0.0001, ctx.currentTime + d);
          v.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + d + 0.02);
          v.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.25);
          o.connect(v).connect(ctx.destination);
          o.start(ctx.currentTime + d);
          o.stop(ctx.currentTime + d + 0.3);
        });
      } catch {}
  }, [g?.flashAt]);

  useEffect(() => {
    if (!session || isGuest) return;
    const timer = setInterval(() => {
      if (!navigator.onLine) return;
      api("/greets")
        .then((list) => {
          setGreets(list);
          // A passenger flashed or asked for help on a Greet that isn't open: open it.
          const call = list.find((x) => x.flashAt && Date.now() - x.flashAt < 8000 && x.flashAt !== lastFlash.current);
          if (call) setG(call);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [session]);

  /* Status taps work offline: a passenger in the jet bridge or at baggage
     often has no signal. "I've landed", "Collecting my bags" and the meeting
     point are kept on the phone and sent the moment it reconnects. */
  const QUEUE = "arigreet-queue-" + (guestToken || "");
  const queueable = (act, value) =>
    isGuest && ((act === "state" && ["LANDED", "BAGGAGE_COLLECTION"].includes(value)) || act === "meeting-point");
  const readQueue = () => {
    try {
      return JSON.parse(localStorage.getItem(QUEUE) || "[]");
    } catch {
      return [];
    }
  };
  const action = async (a, value) => {
    try {
      const next = await api("/greets/" + g.id + "/action", { action: a, value });
      setG(next);
      setGreets((v) => v.map((x) => (x.id === next.id ? next : x)));
      return next;
    } catch (e) {
      if (e.status || !queueable(a, value)) throw e;
      try {
        localStorage.setItem(QUEUE, JSON.stringify([...readQueue(), { a, value, at: Date.now() }]));
      } catch {}
      const local = a === "state" ? { ...g, state: value } : g;
      setG(local);
      setError(t("You’re offline. {peer} will get this as soon as you’re connected.", { peer: first(g.greeter) }));
      return local;
    }
  };
  useEffect(() => {
    if (!isGuest || !g?.id) return;
    const flush = async () => {
      const q = readQueue();
      if (!q.length || !navigator.onLine) return;
      for (const item of q) {
        try {
          const next = await api("/greets/" + g.id + "/action", { action: item.a, value: item.value });
          setG(next);
        } catch (e) {
          if (!e.status) return; // still offline: keep the rest
        }
        try {
          localStorage.setItem(QUEUE, JSON.stringify(readQueue().slice(1)));
        } catch {}
      }
      const queued = t("You’re offline. {peer} will get this as soon as you’re connected.", { peer: first(g.greeter) });
      setError((m) => (m === queued ? "" : m));
    };
    flush();
    addEventListener("online", flush);
    return () => removeEventListener("online", flush);
  }, [g?.id]);
  // Signal comes and goes in airports (and Wi-Fi can say "connected" with no internet): keep trying.
  useEffect(() => {
    if (!noSignal) return;
    const id = setInterval(() => setRetry((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [noSignal]);
  // Keep the greeter's saved copy current whenever their Greets change.
  useEffect(() => {
    if (isGuest || !session || noSignal || !fromServer.current) return;
    saveGreeter(localStorage, session.user?.id, greets, profile);
  }, [greets, profile, session, noSignal]);
  const openGreet = (x) => {
    setG(x);
    setPage("detail");
    scrollTo(0, 0);
  };
  const saveProfile = async (patch) => {
    const next = await api("/profile", patch);
    setProfile(next);
    if (patch.name && session) {
      const s = { ...session, user: { ...session.user, name: next.name } };
      localStorage.setItem("arigreet-session", JSON.stringify(s));
      setSession(s);
    }
    return next;
  };
  const signIn = async (mode, creds) => {
    const data = await api("/auth/" + mode, creds);
    localStorage.setItem("arigreet-session", JSON.stringify(data));
    setSession(data);
    setWelcome(false);
    return data;
  };
  const signOut = () =>
    run(async () => {
      await api("/logout", {}).catch(() => {});
      localStorage.removeItem("arigreet-session");
      clearGreeter(localStorage);
      fromServer.current = false;
      setSession(null);
      setGreets([]);
      setG(null);
      setProfile(null);
      setPage("home");
    });
  const markSent = (x) => {
    if (x?.state !== "CREATED") return;
    api("/greets/" + x.id + "/action", { action: "state", value: "INVITATION_SENT" })
      .then((next) => {
        setG((cur) => (cur?.id === next.id ? next : cur));
        setGreets((v) => v.map((y) => (y.id === next.id ? next : y)));
      })
      .catch(() => {});
  };

  /* Android / iPhone app: hardware back button and tapping an alert. */
  const nav = useRef({});
  nav.current = { modal, flow, page, setModal, setFlow, setPage, greets, openGreet: (x) => openGreet(x) };
  useEffect(() => {
    let off = () => {};
    nativeSetup({
      onBack: () => {
        const n = nav.current;
        if (n.modal) return n.setModal(null), true;
        if (n.flow) return n.setFlow(null), true;
        if (n.page === "detail") return n.setPage("greets"), true;
        if (n.page !== "home") return n.setPage("home"), true;
        return false;
      },
      onLink: (url) => {
        if (location.pathname !== url) location.href = url;
      },
      onOpen: () => {
        const n = nav.current;
        const live = n.greets.find((x) => x.flashAt && Date.now() - x.flashAt < 60000) ||
          n.greets.find((x) => ["PASSENGER_READY", "LIVE_GREET", "NEARBY", "VERY_CLOSE"].includes(x.state));
        if (live) n.openGreet(live);
      },
    }).then((f) => (off = f));
    return () => off();
  }, []);

  /* Once a link has gone out, make sure the greeter will hear back (fix #1). */
  useEffect(() => {
    if (isGuest || !session || page !== "detail" || !g || flow || modal) return;
    if (g.state === "CREATED" || ENDED.includes(g.state) || profile?.notifications?.enabled) return;
    try {
      if (localStorage.getItem("arigreet-alerts-asked")) return;
    } catch {}
    const t = setTimeout(() => setModal("alerts"), 600);
    return () => clearTimeout(t);
  }, [page, g?.id, g?.state, flow, modal, profile?.notifications?.enabled]);

  /* Create / edit a Greet (spec §9–19) */
  const create = () => {
    const p = profile || {};
    const v = p.vehicles?.[0];
    setFlow({
      editing: false,
      initial: {
        ...blankGreet(),
        greeter: p.name || session?.user?.name || "",
        greeterPhoto: p.photo || "",
        company: p.company || "",
        contact: p.phone || "",
        ...(p.board || {}),
        ...(v ? { vehicle: v.vehicle, colour: v.colour, plate: v.plate, vehiclePhoto: v.photo } : {}),
      },
    });
  };
  /* Arriving from the website's greeting board generator:
     /app?name=Helen%20Smith&airport=ATH&style=klein opens Create Greet prefilled. */
  useEffect(() => {
    if (isGuest) return;
    const q = new URLSearchParams(location.search);
    const name = (q.get("name") || "").trim().slice(0, 80);
    if (!name) return;
    history.replaceState(null, "", location.pathname);
    setWelcome(false);
    const theme = { klein: "Signature", dark: "Dark", light: "Light" }[q.get("style")] || "Signature";
    const iata = (q.get("airport") || "").toUpperCase();
    const open = (extra = {}) => {
      create();
      setFlow((f) => f && { ...f, initial: { ...f.initial, name, theme, ...extra } });
    };
    if (!/^[A-Z]{3}$/.test(iata)) return open();
    loadAirports()
      .then((list) => {
        const a = list.find((x) => x.iata === iata);
        const t = TERMINALS[iata];
        open(
          a
            ? {
                airport: `${a.city} (${a.iata})`,
                airportCode: a.iata,
                airportTimezone: a.tz,
                airportFull: a.name,
                airportLat: a.lat,
                airportLng: a.lon,
                terminal: t?.length === 1 ? t[0] : "",
              }
            : {},
        );
      })
      .catch(() => open());
  }, []);
  const editGreet = () => setFlow({ editing: true, initial: { ...blankGreet(), ...g } });
  const submitGreet = async (data, token) => {
    const next = flow?.editing
      ? await api("/greets/" + g.id + "/action", { action: "edit", value: data }, token)
      : await api("/greets", data, token);
    setGreets((v) => (flow?.editing ? v.map((x) => (x.id === next.id ? next : x)) : [next, ...v]));
    setG(next);
    if (data.saveVehicle && data.vehicle) {
      const auth = token || session?.token;
      if (auth)
        try {
          const prof = profile || (await api("/profile", undefined, token));
          const list = (prof.vehicles || []).filter((x) => x.plate !== data.plate);
          const saved = await api(
            "/profile",
            { vehicles: [{ id: Date.now().toString(36), vehicle: data.vehicle, colour: data.colour, plate: data.plate, photo: data.vehiclePhoto }, ...list] },
            token,
          );
          setProfile(saved);
        } catch {}
    }
    return next;
  };

  /* Location (spec §30–35) — only after the explanation sheet */
  const locationStart = () =>
    run(async () => {
      if (isGuest && !LIVE_STATES.includes(g.state)) await action("state", "PASSENGER_READY");
      setModal(null);
      setGuestView("live");
      if (!navigator.geolocation)
        throw Error(t("Location isn’t available on this device. Use the meeting point and the GreetBoard."));
      stopLocal();
      watch.current = navigator.geolocation.watchPosition(
        (p) => {
          setSharing(true);
          api("/greets/" + g.id + "/action", {
            action: "location",
            value: {
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy,
              heading: p.coords.heading,
              speed: p.coords.speed,
            },
          })
            .then((next) => {
              setG(next);
              setGreets((v) => v.map((x) => (x.id === next.id ? next : x)));
            })
            .catch((e) => setError(e.message));
        },
        (e) => {
          stopLocal();
          setError(
            e.code === 1
              ? t("Location is blocked. Turn it on in your browser settings, or use the meeting point and the GreetBoard.")
              : t("Your location isn’t available right now. Use the meeting point and the GreetBoard."),
          );
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    });
  const skipLocation = () =>
    run(async () => {
      if (isGuest && !LIVE_STATES.includes(g.state)) await action("state", "PASSENGER_READY");
      setModal(null);
      setGuestView("live");
    });
  /* While location is shared, keep the screen on: phones stop GPS in a locked
     browser tab, and the other person loses you on the map. */
  useEffect(() => {
    if (!sharing || !navigator.wakeLock) return;
    let lock = null,
      live = true;
    const grab = () =>
      document.visibilityState === "visible" &&
      navigator.wakeLock
        .request("screen")
        .then((l) => (live ? (lock = l) : l.release?.()))
        .catch(() => {});
    grab();
    document.addEventListener("visibilitychange", grab);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", grab);
      lock?.release?.();
    };
  }, [sharing]);
  const stopSharing = () =>
    run(async () => {
      stopLocal();
      await action("stop");
    });

  const positions = g?.locations || {};
  let distance = null;
  if (positions.guest && positions.greeter) {
    const a = positions.guest,
      b = positions.greeter,
      r = Math.PI / 180;
    const h =
      Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
      Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
    distance = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  }
  const fresh = Object.values(positions).every((p) => now - p.timestamp < 30000);
  const accurate = Object.values(positions).every((p) => p.accuracy <= 30);

  const banner = <ConnectionBanner online={online && !noSignal} error={error} onDismiss={() => setError("")} t={t} />;
  const ctx = {
    session, profile, saveProfile, signIn, signOut, isGuest, role, g, setG, greets,
    api, action, run, busy, error, setError, online, now, positions, distance, fresh,
    accurate, sharing, locationStart, skipLocation, stopSharing, stopLocal, modal,
    setModal, page, setPage, openGreet, selectGreet: setG, create, editGreet, pickupPhoto,
    enableNotifications, offlinePickup, cachedAt, guestView, setGuestView, guestFail,
    markSent, banner, t, lang, setLang,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className={isGuest ? "app-guest" : "app-greeter"}>
        {!isGuest && !session && welcome && (
          <Welcome
            intro={replayIntro ? true : "auto"}
            onStart={() => setWelcome(false)}
            onSignIn={() => {
              setWelcome(false);
              setModal("auth");
            }}
          />
        )}
        {flashPreview && <FlashPreview onClose={() => setFlashPreview(false)} />}
        {isGuest ? (
          <>
            {g && banner}
            <main className="gs-main">
              <Guest />
            </main>
          </>
        ) : (
          (!welcome || session) && <Greeter />
        )}
        {flow && (
          <CreateFlow
            key={flow.editing ? "edit-" + g?.id : "new"}
            initial={flow.initial}
            editing={flow.editing}
            session={session}
            onClose={() => setFlow(null)}
            onSubmit={submitGreet}
            onAuth={async (mode, creds) => {
              const data = await api("/auth/" + mode, creds);
              localStorage.setItem("arigreet-session", JSON.stringify(data));
              setSession(data);
              return data;
            }}
            onShared={markSent}
            onViewGreet={(x) => {
              setFlow(null);
              setG((prev) => (prev?.id === x.id ? prev : x));
              setPage("detail");
            }}
            onShowBoard={(x) => {
              setFlow(null);
              setG((prev) => (prev?.id === x.id ? prev : x));
              setPage("detail");
              setModal("board");
            }}
          />
        )}
        {modal === "board" && g && (
          <Board
            g={g}
            now={now}
            onClose={() => setModal(null)}
            onSeeGuest={LIVE_STATES.includes(g.state) ? () => setModal("confirm") : undefined}
          />
        )}
        {modal === "finder" && g && LIVE_STATES.includes(g.state) && <Finder onClose={() => setModal(null)} />}
        <Sheets />
      </div>
    </AppCtx.Provider>
  );
}
const legalPage = /^\/(privacy|terms)\/?$/.exec(location.pathname)?.[1];
if (!window.__ARIGREET_PREVIEW__)
  createRoot(document.getElementById("root")).render(legalPage ? <Legal page={legalPage} /> : <App />);
