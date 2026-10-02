import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  X,
  Link,
  Check,
  Zap,
  ScanLine,
  ClipboardPaste,
} from "lucide-react";
import { BeaconStars, BrandMark } from "./HomeView.jsx";
import { PinMark, Wordmark } from "./Brand.jsx";
import "./welcome.css";

export function FlashPreview({ onClose }) {
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setFlashing(false), 8000);
    return () => clearTimeout(timer);
  }, [flashing]);
  return (
    <section
      className={"flash-preview " + (flashing ? "is-flashing" : "")}
      aria-label="Interactive GreetBoard preview"
    >
      <div className="flash-top">
        <span>
          <BrandMark size={22} /> GreetBoard · Preview
        </span>
        <button onClick={onClose} aria-label="Close preview">
          <X />
        </button>
      </div>
      <div className="flash-sign">
        <BeaconStars />
        <h1>
          SARAH
          <br />
          JOHNSON
        </h1>
        <p>A3 123 · Athens</p>
      </div>
      <div className="flash-controls">
        <div aria-live="polite">
          <span className="signal-dot" />
          {flashing
            ? "Sarah is looking for you"
            : "One signal. Instantly familiar."}
        </div>
        <button
          className="signal-button"
          onClick={() => setFlashing(!flashing)}
        >
          <Zap size={19} />
          {flashing ? "Stop flash" : "Try the flash"}
        </button>
        <p>
          {flashing
            ? "Your board pulses for 8 seconds."
            : "See what happens when your guest taps Flash."}
        </p>
      </div>
    </section>
  );
}

const reduced = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Splash: a lime point drops onto the screen, blooms into the Klein Blue pin,
   the lime band sweeps across, the ground pings, the name writes itself in.
   Then the pin flies into the welcome header (a shared-element handoff). */
function Splash({ targetRef, onHandoff, onDone }) {
  const markRef = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    onHandoff();
    const from = markRef.current?.getBoundingClientRect();
    const to = targetRef.current?.getBoundingClientRect();
    if (!from || !to || !from.width || reduced()) {
      setTimeout(onDone, reduced() ? 200 : 450);
      return;
    }
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const k = to.width / from.width;
    const flight = markRef.current.animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)" },
        {
          transform: `translate(${dx * 0.55}px, ${dy * 0.42}px) scale(${(1 + k) / 2}) rotate(-6deg)`,
          offset: 0.55,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(0deg)` },
      ],
      {
        duration: 820,
        easing: "cubic-bezier(0.65, 0, 0.2, 1)",
        fill: "forwards",
      },
    );
    flight.onfinish = onDone;
  };
  useEffect(() => {
    const t = setTimeout(finish, reduced() ? 700 : 2700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={"splash " + (leaving ? "is-leaving" : "")}
      onClick={finish}
      role="img"
      aria-label="Arigreet. Find each other at Arrivals."
    >
      <div className="splash-stage">
        <div className="splash-mark">
          <span className="splash-ping" />
          <span className="splash-ping two" />
          <span className="splash-drop" />
          <div ref={markRef} className="splash-pin">
            <PinMark size={120} />
          </div>
        </div>
        <Wordmark className="splash-word" split />
        <p className="splash-tag">Find each other at Arrivals.</p>
      </div>
      <span className="splash-spacer" />
    </div>
  );
}

const INTRO_KEY = "arigreet-intro-seen";

const TOKEN = /(?:\/g\/)?([a-f0-9]{48})(?:[/?#]|$)/i;

/* Paste or scan the link a greeter sent. Lives in a sheet on Home. */
export function JoinForm({ active = true }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const video = useRef(null);
  const canScan =
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    !!navigator.mediaDevices?.getUserMedia;
  const open = (text) => {
    const match = String(text || "")
      .trim()
      .match(TOKEN);
    if (!match) {
      setError(
        "That doesn’t look like an Arigreet link. Check the message from your greeter.",
      );
      return false;
    }
    const url = "/g/" + match[1].toLowerCase();
    if (window.__arigreetOpen) window.__arigreetOpen(url);
    else location.href = url;
    return true;
  };
  useEffect(() => {
    if (!scanning) return;
    let stream,
      frame,
      stopped = false;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        video.current.srcObject = s;
        return video.current.play();
      })
      .then(() => {
        const tick = async () => {
          if (stopped) return;
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0] && open(codes[0].rawValue)) return;
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        setError("Camera unavailable. Paste your link instead.");
        setScanning(false);
      });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);
  useEffect(() => {
    if (!active) setScanning(false);
  }, [active]);
  return (
    <div className="join-sheet">
      <p className="sh-lede">
        The person meeting you sends one link by WhatsApp, text or email. Open
        it, or paste it here.
      </p>
      {scanning ? (
        <div className="scan-frame">
          <video ref={video} playsInline muted />
          <span className="scan-corners" />
          <button className="step-link" onClick={() => setScanning(false)}>
            Cancel scanning
          </button>
        </div>
      ) : (
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            open(value);
          }}
        >
          <label className="join-field">
            <span>Your Arigreet link</span>
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              placeholder="arigreet.com/g/…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              inputMode="url"
            />
            {navigator.clipboard?.readText && (
              <button
                type="button"
                aria-label="Paste link"
                onClick={() =>
                  navigator.clipboard
                    .readText()
                    .then((t) => {
                      setValue(t);
                      setError("");
                    })
                    .catch(() => {})
                }
              >
                <ClipboardPaste size={19} />
              </button>
            )}
          </label>
          {error && <p className="join-error">{error}</p>}
          <button className="welcome-primary" disabled={!value.trim()}>
            <span>Open my Greet</span>
            <i>
              <ArrowRight size={20} />
            </i>
          </button>
          {canScan && (
            <button
              type="button"
              className="welcome-secondary"
              onClick={() => {
                setError("");
                setScanning(true);
              }}
            >
              <ScanLine size={20} /> Scan QR code
            </button>
          )}
        </form>
      )}
      <div className="join-note">
        <Link size={18} />
        <p>
          <b>No link yet?</b> Ask the person picking you up to send your Greet
          from Arigreet. You won’t need an account or the app.
        </p>
      </div>
    </div>
  );
}

/* First launch: splash, then one welcome screen. Get Started goes straight
   to Home, where Create Greet is the first thing they see. */
export default function Welcome({ onStart, onSignIn, intro = "auto" }) {
  // Full splash plays on first launch (or when asked for); later launches
  // open straight onto the welcome screen, the way Apple recommends.
  const [phase, setPhase] = useState(() => {
    if (intro !== "auto") return intro ? "splash" : "shown";
    try {
      return localStorage.getItem(INTRO_KEY) ? "shown" : "splash";
    } catch {
      return "splash";
    }
  });
  const introDone = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {}
    setPhase("shown");
  };
  const logoRef = useRef(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = meta?.content;
    meta?.setAttribute("content", "#ffffff");
    return () => {
      document.body.style.overflow = previous;
      if (meta && color) meta.setAttribute("content", color);
    };
  }, []);
  return (
    <section
      className={"welcome-experience phase-" + phase}
      aria-label="Welcome to Arigreet"
    >
      <div
        className="w-screen is-active"
        inert={phase === "splash" ? true : undefined}
      >
        <div className="welcome-page hero-layout">
          <figure className="welcome-hero" aria-hidden="true">
            <img src="/welcome/arrivals.jpg" alt="" />
          </figure>
          <header className="welcome-header">
            <div className="welcome-brand">
              <span ref={logoRef} className="welcome-logo">
                <PinMark size={34} />
              </span>
              <Wordmark />
            </div>
          </header>
          <div className="welcome-bottom">
            <h1>
              <span className="w-line" style={{ "--d": 0 }}>
                Find each other
              </span>{" "}
              <span className="w-line" style={{ "--d": 1 }}>
                at <em>Arrivals.</em>
              </span>
            </h1>
            <p className="w-rise" style={{ "--d": 2 }}>
              Set up a pickup, send a link, and find each other the moment they land.
            </p>
            <div className="welcome-actions w-rise" style={{ "--d": 3 }}>
              <button
                className="welcome-primary"
                onClick={onStart}
              >
                <span>Get Started</span>
                <i>
                  <ArrowRight size={20} />
                </i>
              </button>
              <button className="welcome-signin" onClick={onSignIn}>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
      {phase !== "shown" && (
        <Splash
          targetRef={logoRef}
          onHandoff={() => setPhase("handoff")}
          onDone={introDone}
        />
      )}
    </section>
  );
}
