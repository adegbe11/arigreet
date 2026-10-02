import React, { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Navigation,
  MapPin,
  Camera,
  Minus,
  Plus,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  Mail,
  QrCode,
  Share2,
  Car,
  Phone,
  Bell,
  SquarePlus,
  Share as ShareIcon,
  LocateFixed,
} from "lucide-react";
import QRCode from "qrcode";
import { useApp, Sheet, first, Plate, Avatar, airportName, LIVE } from "./ui.jsx";
import { JoinForm } from "./Welcome.jsx";
import { isNative, SITE } from "./native.js";
import GoogleButton from "./GoogleButton.jsx";

function shrink(file, max = 560) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(Error("That photo couldn't be opened."));
    img.src = URL.createObjectURL(file);
  });
}

/* "I can't find you": tell the greeter at once, light up his board, and give
   the passenger everything she needs to spot him while she waits. */
function Help({ close }) {
  const a = useApp();
  const { t } = a;
  const g = a.g;
  const peer = first(g.greeter);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    a.run(async () => {
      if (!["LANDED", "BAGGAGE_COLLECTION", ...LIVE].includes(g.state)) await a.action("state", "LANDED");
      await a.action("help");
      setSent(true);
    }).catch(() => {});
  }, []);
  const photo = a.pickupPhoto(g, "greeter");
  return (
    <Sheet title={sent ? t("{peer} has been told", { peer }) : t("Telling {peer}…", { peer })} onClose={close}>
      <p className="sh-lede">
        {t("{peer}’s GreetBoard is lighting up now. Stay where you are, look around, and look for your name.", { peer })}
      </p>
      <div className="sh-point">
        {photo ? <img className="sh-face" src={photo} alt={g.greeter} /> : <MapPin size={22} />}
        <div>
          <b>{g.greeter}</b>
          <span>{t("Waiting at {place}", { place: [g.area, g.exit].filter(Boolean).join(" · ") || t("Arrivals") })}</span>
          {g.landmark && <span>{g.landmark}</span>}
        </div>
      </div>
      {g.vehicle && (
        <div className="sh-point">
          <Car size={22} />
          <div>
            <b>{[g.colour, g.vehicle].filter(Boolean).join(" ")}</b>
            {g.plate && <Plate>{g.plate}</Plate>}
          </div>
        </div>
      )}
      {a.positions.guest && a.positions.greeter && LIVE.includes(g.state) && (
        <button className="btn lime" onClick={() => a.setModal("finder")}>
          <LocateFixed size={19} /> {t("Find {peer}", { peer })}
        </button>
      )}
      {g.allowCall && g.contact && (
        <a className="btn primary" href={"tel:" + g.contact}>
          <Phone size={19} /> {t("Call {peer}", { peer })}
        </a>
      )}
      <button className="btn ghost" onClick={close}>
        {t("OK")}
      </button>
    </Sheet>
  );
}

/* Right after the link goes out: make sure the greeter will actually hear
   "Helen has landed". iPhone only delivers web alerts to Home Screen apps. */
function Alerts({ close }) {
  const a = useApp();
  const n = first(a.g?.name) || "your guest";
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const needsHome = ios && !standalone && !isNative;
  const done = () => {
    try {
      localStorage.setItem("arigreet-alerts-asked", "1");
    } catch {}
    close();
  };
  return (
    <Sheet title={`Know the moment ${n} lands`} onClose={done}>
      <span className="sh-icon">
        <Bell size={28} />
      </span>
      {needsHome ? (
        <>
          <p className="sh-lede">On iPhone, alerts only work once Arigreet is on your Home Screen. It takes ten seconds:</p>
          <ol className="sh-steps">
            <li>
              <ShareIcon size={18} /> Tap <b>Share</b> at the bottom of Safari
            </li>
            <li>
              <SquarePlus size={18} /> Choose <b>Add to Home Screen</b>
            </li>
            <li>
              <Bell size={18} /> Open Arigreet from your Home Screen and turn alerts on
            </li>
          </ol>
          <button className="btn primary" onClick={done}>
            Got it
          </button>
        </>
      ) : (
        <>
          <p className="sh-lede">
            We’ll tell you when {n} opens the link, lands, collects their bags and is ready to meet. Nothing else.
          </p>
          <button
            className="btn primary"
            disabled={a.busy}
            onClick={() =>
              a.run(async () => {
                await a.enableNotifications();
                await a.saveProfile({ notifications: { ...(a.profile?.notifications || {}), enabled: true } });
                done();
              })
            }
          >
            Turn on alerts
          </button>
          <button className="btn ghost" onClick={done}>
            Not now
          </button>
        </>
      )}
    </Sheet>
  );
}

/* Spec §30 / §31 — explain first, then the browser prompt. */
function Permission({ close }) {
  const a = useApp();
  const { t } = a;
  const g = a.g;
  const peer = first(a.isGuest ? g.greeter : g.name);
  return (
    <Sheet onClose={close} label={t("Share your location")}>
      <span className="sh-icon">
        <Navigation size={30} />
      </span>
      <h2 className="ui-sheet-title">{t("Share your location with {peer}", { peer })}</h2>
      <p className="sh-lede">{t("Your location helps you find each other at the airport.")}</p>
      <ul className="sh-points">
        <li><ShieldCheck size={20} /> {t("Only shared during this Greet")}</li>
        <li><ShieldCheck size={20} /> {t("Only {peer} can see it", { peer })}</li>
        <li><ShieldCheck size={20} /> {t("Stops when you meet or end sharing")}</li>
      </ul>
      <button className="btn primary" disabled={a.busy} onClick={a.locationStart}>
        {t("Share my location")}
      </button>
      <button className="btn ghost" disabled={a.busy} onClick={a.skipLocation}>
        {t("Not now")}
      </button>
    </Sheet>
  );
}

function Confirm({ close }) {
  const a = useApp();
  const { t } = a;
  return (
    <Sheet onClose={close} label={t("Did you find each other?")}>
      <span className="sh-hand">👋</span>
      <h2 className="ui-sheet-title center">{t("Did you find each other?")}</h2>
      <p className="sh-lede center">{t("Confirm once you’re face to face. Location sharing stops when you’ve met.")}</p>
      <button
        className="btn primary"
        disabled={a.busy}
        onClick={() =>
          a.run(async () => {
            await a.action("confirm");
            close();
          })
        }
      >
        {t("Yes, we’ve met")}
      </button>
      <button className="btn ghost" onClick={close}>
        {t("Not yet")}
      </button>
    </Sheet>
  );
}

function Meeting({ close }) {
  const a = useApp();
  const g = a.g;
  const mine = a.isGuest ? g.meetingIntent : g.greeterIntent;
  const atPoint = mine?.atPoint && a.now - mine.at < 10 * 60000;
  const live = LIVE.includes(g.state);
  const { t } = a;
  return (
    <Sheet title={t("Meeting point")} onClose={close}>
      <div className="sh-point">
        <MapPin size={22} />
        <div>
          <b>{[g.area, g.exit].filter(Boolean).join(" · ")}</b>
          <span>{[airportName(g.airport), g.terminal].filter(Boolean).join(" · ")}</span>
          {g.landmark && <span>{g.landmark}</span>}
        </div>
      </div>
      {g.instructions && <p className="sh-quote">“{g.instructions}”</p>}
      {a.isGuest && g.vehicle && (
        <div className="sh-point">
          <Car size={22} />
          <div>
            <b>{[g.colour, g.vehicle].filter(Boolean).join(" ")}</b>
            {g.plate && <Plate>{g.plate}</Plate>}
          </div>
        </div>
      )}
      {live && (
        <button
          className={"btn " + (atPoint ? "ghost" : "primary")}
          disabled={a.busy}
          onClick={() => a.run(() => a.action("meeting-point", { atPoint: !atPoint }))}
        >
          {atPoint ? t("I’ve left {place}", { place: g.exit || g.area }) : t("I’m at {place}", { place: g.exit || g.area })}
        </button>
      )}
      {live && (
        <p className="sh-note">
          {atPoint
            ? t("{peer} can see you’re at the meeting point.", { peer: first(a.isGuest ? g.greeter : g.name) })
            : t("Tell {peer} when you’re there. It helps when indoor GPS is weak.", { peer: first(a.isGuest ? g.greeter : g.name) })}
        </p>
      )}
    </Sheet>
  );
}

function Cancel({ close }) {
  const a = useApp();
  return (
    <Sheet title="Cancel this Greet?" onClose={close}>
      <p className="sh-lede">{first(a.g.name)}’s link will stop working and location sharing will end.</p>
      <button
        className="btn danger"
        disabled={a.busy}
        onClick={() =>
          a.run(async () => {
            await a.action("state", "CANCELLED");
            a.stopLocal();
            close();
          })
        }
      >
        Cancel Greet
      </button>
      <button className="btn ghost" onClick={close}>
        Keep Greet
      </button>
    </Sheet>
  );
}

/* Spec §25 */
function Identify({ close }) {
  const a = useApp();
  const g = a.g;
  const [f, setF] = useState({ wearing: "", bagDescription: "", other: "", photo: "", bags: g.bags ?? 1, ...(g.identification || {}) });
  const file = useRef(null);
  const peer = first(g.greeter);
  const { t } = a;
  return (
    <Sheet title={t("Help {peer} recognize you", { peer })} onClose={close}>
      <form
        className="sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          a.run(async () => {
            await a.action("identify", f);
            close();
          });
        }}
      >
        <div className="sh-photo">
          <button type="button" onClick={() => file.current.click()} aria-label={t("Add a photo of yourself")}>
            {f.photo ? <img src={f.photo} alt="" /> : <Camera size={26} />}
          </button>
          <span>
            <b>{t("Photo")}</b>
            <small>{t("Optional · a quick selfie helps most")}</small>
          </span>
          <input ref={file} type="file" accept="image/*" capture="user" hidden onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, photo: await shrink(x) }); }} />
        </div>
        <label className="fld"><span>{t("What are you wearing?")}</span><input value={f.wearing} placeholder={t("Cream jacket")} onChange={(e) => setF({ ...f, wearing: e.target.value })} /></label>
        <div className="fld-step">
          <b>{t("Bags")}</b>
          <div>
            <button type="button" aria-label={t("Fewer bags")} disabled={f.bags <= 0} onClick={() => setF({ ...f, bags: f.bags - 1 })}><Minus size={18} /></button>
            <output>{f.bags}</output>
            <button type="button" aria-label={t("More bags")} onClick={() => setF({ ...f, bags: f.bags + 1 })}><Plus size={18} /></button>
          </div>
        </div>
        <label className="fld"><span>{t("Bag description")}</span><input value={f.bagDescription} placeholder={t("Blue suitcase")} onChange={(e) => setF({ ...f, bagDescription: e.target.value })} /></label>
        <label className="fld"><span>{t("Additional note")}</span><input value={f.other} placeholder={t("Travelling with my son")} onChange={(e) => setF({ ...f, other: e.target.value })} /></label>
        <button className="btn primary" disabled={a.busy}>{t("Save")}</button>
        <p className="sh-note center">{t("Only {peer} can see this information during your Greet.", { peer })}</p>
      </form>
    </Sheet>
  );
}

function Auth({ close, initialMode = "login" }) {
  const a = useApp();
  const [mode, setMode] = useState(initialMode);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const title = { login: "Sign in", register: "Create your account", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  return (
    <Sheet title={title} onClose={close}>
      <form
        className="sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          a.run(async () => {
            if (mode === "forgot") {
              const r = await a.api("/auth/forgot", { email: f.email });
              setMsg(r.message || "Check your email for a reset link.");
            } else if (mode === "reset") {
              const r = await a.api("/auth/reset", { token: new URLSearchParams(location.search).get("reset"), password: f.password });
              setMsg(r.message || "Password updated. Sign in.");
              setMode("login");
            } else {
              await a.signIn(mode, f);
              close();
            }
          });
        }}
      >
        {(mode === "login" || mode === "register") && (
          <>
            <GoogleButton
              disabled={a.busy}
              onError={a.setError}
              onToken={(idToken) => a.run(async () => { await a.signIn("google", { idToken }); close(); })}
              or
            />
          </>
        )}
        {mode === "register" && (
          <label className="fld"><span>Your name</span><input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        )}
        {mode !== "reset" && (
          <label className="fld"><span>Email</span><input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        )}
        {mode !== "forgot" && (
          <label className="fld">
            <span>Password</span>
            <input required type="password" minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            {mode !== "login" && <small>At least 10 characters.</small>}
          </label>
        )}
        {msg && <p className="sh-note">{msg}</p>}
        {mode === "register" && (
          <p className="sh-note">
            By creating an account you agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>.
          </p>
        )}
        <button className="btn primary" disabled={a.busy}>
          {a.busy ? "Please wait…" : { login: "Sign in", register: "Create account", forgot: "Send reset link", reset: "Save password" }[mode]}
        </button>
        {mode === "login" && (
          <>
            <button type="button" className="btn ghost" onClick={() => setMode("register")}>Create an account</button>
            <button type="button" className="sh-link" onClick={() => setMode("forgot")}>Forgot password?</button>
          </>
        )}
        {mode !== "login" && (
          <button type="button" className="sh-link" onClick={() => setMode("login")}>Already have an account? Sign in</button>
        )}
      </form>
    </Sheet>
  );
}

function Share({ close }) {
  const a = useApp();
  const g = a.g;
  const n = first(g.name);
  const link = SITE + "/g/" + g.token;
  const [message, setMessage] = useState(
    `Hi ${n}, it's ${first(g.greeter) || "me"}. I'm meeting you at ${airportName(g.airport) || "the"} Airport. Save this link and open it when you land, so we find each other fast. No app needed.`,
  );
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const text = message + "\n" + link;
  const sent = () => a.markSent(g);
  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      sent();
    } catch {
      a.setError("Couldn't copy. Press and hold the link to copy it.");
    }
  };
  return (
    <Sheet title={`Send to ${n}`} onClose={close}>
      <p className="sh-lede">{n} opens it without an app or account.</p>
      <label className="fld"><span>Message</span><textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      <div className="sh-link-box">
        <span>{link.replace(/^https?:\/\//, "")}</span>
        <button onClick={() => copy(link)} aria-label="Copy link">{copied ? <Check size={18} /> : <Copy size={18} />}</button>
      </div>
      <div className="sh-share">
        <a href={"https://wa.me/?text=" + encodeURIComponent(text)} target="_blank" rel="noreferrer" onClick={sent}><MessageCircle size={22} />WhatsApp</a>
        <a href={"sms:" + (g.phone || "") + "?&body=" + encodeURIComponent(text)} onClick={sent}><MessageSquare size={22} />Messages</a>
        <a href={"mailto:" + (g.email || "") + "?subject=" + encodeURIComponent("Your pickup at the airport") + "&body=" + encodeURIComponent(text)} onClick={sent}><Mail size={22} />Email</a>
        <button onClick={() => copy(text)}>{copied ? <Check size={22} /> : <Copy size={22} />}{copied ? "Copied" : "Copy link"}</button>
        <button onClick={async () => { setQr(qr ? "" : await QRCode.toDataURL(link, { width: 480, margin: 1 })); sent(); }}><QrCode size={22} />QR code</button>
        {navigator.share && (
          <button onClick={() => navigator.share({ title: "Your Arigreet pickup", text: message, url: link }).then(sent).catch(() => {})}><Share2 size={22} />More</button>
        )}
      </div>
      {qr && (
        <figure className="sh-qr">
          <img src={qr} alt={`QR code for ${n}'s pickup link`} />
          <figcaption>{n} scans this to open the pickup.</figcaption>
        </figure>
      )}
    </Sheet>
  );
}

export default function Sheets() {
  const a = useApp();
  const close = () => a.setModal(null);
  switch (a.modal) {
    case "auth":
      return <Auth close={close} />;
    case "register":
      return <Auth close={close} initialMode="register" />;
    case "reset":
      return <Auth close={close} initialMode="reset" />;
    case "join":
      return (
        <Sheet title="Open your Greet" onClose={close}>
          <JoinForm />
        </Sheet>
      );
  }
  if (!a.g) return null;
  switch (a.modal) {
    case "permission":
      return <Permission close={close} />;
    case "confirm":
      return <Confirm close={close} />;
    case "meeting":
      return <Meeting close={close} />;
    case "cancel":
      return <Cancel close={close} />;
    case "identify":
      return <Identify close={close} />;
    case "share":
      return <Share close={close} />;
    case "help":
      return <Help close={close} />;
    case "alerts":
      return <Alerts close={close} />;
    default:
      return null;
  }
}
