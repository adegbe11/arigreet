import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, Check, RotateCw } from "lucide-react";
import { first } from "./ui.jsx";

/* GreetBoard (spec §39–40): the phone becomes the sign.
   - The name is sized to fill the screen, as big as the words allow.
   - It is alive: a slow light sweeps across the letters, sparkles drift over
     the Klein Blue, and a lime ring breathes around the edge, so it catches an
     eye across a crowded Arrivals hall.
   - When the passenger taps FLASH MY GREETER it goes brighter for 8 seconds:
     more sparkles and a stronger lime pulse, never faster than 2 per second
     (well under the 3-a-second flash limit for photosensitive viewers).
   - Reduce Motion turns all of it off and leaves a still, bold sign. */

const STYLES = { Signature: "klein", Dark: "dark", Light: "light" };
const FONT = '900 100px -apple-system, "SF Pro Display", "Inter var", system-ui, sans-serif';

function useFit(lines, box) {
  const [fit, setFit] = useState({ size: 80, stretch: 1 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ctx = document.createElement("canvas").getContext("2d");
    const fit = () => {
      ctx.font = FONT;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
      const w = el.clientWidth * 0.94;
      const h = el.clientHeight;
      const byWidth = (100 * w) / widest;
      const byHeight = h / (lines.length * 0.92);
      const size = Math.max(28, Math.min(byWidth, byHeight));
      // Tall sign letters read from further away: stretch upward into spare height.
      const stretch = Math.max(1, Math.min(2.1, h / (lines.length * size * 0.92)));
      setFit({ size, stretch });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [lines.join(" ")]);
  return fit;
}

/* Sparkles: small four-point stars that twinkle and drift upward. */
function Sparkles({ hot, light }) {
  const ref = useRef(null);
  const hotRef = useRef(hot);
  hotRef.current = hot;
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current;
    const ctx = c.getContext("2d");
    const dpr = Math.min(2, devicePixelRatio || 1);
    let w, h, raf;
    const parts = [];
    const size = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener("resize", size);
    const spawn = () => ({
      x: Math.random() * w,
      y: h * (0.15 + Math.random() * 0.85),
      r: 2 + Math.random() * (hotRef.current ? 7 : 4.5),
      life: 0,
      max: 1400 + Math.random() * 1600,
      vy: -(6 + Math.random() * 18),
      lime: Math.random() < 0.45,
    });
    let last = performance.now();
    const star = (x, y, r, a, lime) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = lime ? "#ccff00" : light ? "#002fa7" : "#ffffff";
      ctx.shadowColor = lime ? "rgba(204,255,0,0.9)" : light ? "rgba(0,47,167,0.6)" : "rgba(255,255,255,0.9)";
      ctx.shadowBlur = r * 3;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 2);
      ctx.quadraticCurveTo(x, y, x + r * 2, y);
      ctx.quadraticCurveTo(x, y, x, y + r * 2);
      ctx.quadraticCurveTo(x, y, x - r * 2, y);
      ctx.quadraticCurveTo(x, y, x, y - r * 2);
      ctx.fill();
      ctx.restore();
    };
    const tick = (t) => {
      const dt = Math.min(64, t - last);
      last = t;
      const want = hotRef.current ? 70 : 34;
      while (parts.length < want) parts.push(spawn());
      ctx.clearRect(0, 0, w, h);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        p.y += (p.vy * dt) / 1000;
        const k = p.life / p.max;
        if (k >= 1) {
          parts.splice(i, 1);
          continue;
        }
        const a = Math.sin(k * Math.PI); // fade in, then out
        star(p.x, p.y, p.r * (0.6 + 0.4 * a), a * 0.95, p.lime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
    };
  }, [light]);
  return <canvas ref={ref} className="gb-sparkles" aria-hidden="true" />;
}

export default function Board({ g, now, onClose, onSeeGuest, preview }) {
  const flashing = !preview && now - (g.flashAt || 0) < 8000;
  const style = STYLES[g.theme] || "klein";
  const lines = (g.boardName === "First name" ? first(g.name) : g.name || "")
    .toUpperCase()
    .split(/\s+/)
    .flatMap((w) => (w.length > 9 && w.includes("-") ? w.split(/(?<=-)/) : [w]))
    .filter(Boolean);
  const box = useRef(null);
  const { size, stretch } = useFit(lines.length ? lines : [" "], box);
  const [landscape, setLandscape] = useState(() => matchMedia("(orientation: landscape)").matches);
  useEffect(() => {
    const m = matchMedia("(orientation: landscape)");
    const on = () => setLandscape(m.matches);
    m.addEventListener?.("change", on);
    let lock;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    // Where the browser allows it (Android), hide the browser bars too.
    if (!preview) document.documentElement.requestFullscreen?.().catch(() => {});
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      m.removeEventListener?.("change", on);
      lock?.release?.();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      document.body.style.overflow = o;
    };
  }, []);
  const wantsLandscape = g.boardOrientation === "Landscape";
  return (
    <div
      className={`gb ${style} ${flashing ? "flashing" : ""} ${landscape ? "is-land" : "is-port"}`}
      role="dialog"
      aria-modal="true"
      aria-label={"GreetBoard for " + g.name}
    >
      <div className="gb-aura" aria-hidden="true" />
      <Sparkles hot={flashing} light={style === "light"} />
      <div className="gb-ring" aria-hidden="true" />
      <button className="gb-x" onClick={onClose} aria-label="Close GreetBoard">
        <X size={20} />
      </button>
      {g.boardShowLogo && g.companyLogo && <img className="gb-logo" src={g.companyLogo} alt="" />}
      <div className="gb-center">
        <div className="gb-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="gb-fit" ref={box}>
          <h1 className="gb-name" style={{ fontSize: size + "px", transform: `scaleY(${stretch})` }}>
            {lines.map((w, i) => (
              <span key={i} data-text={w}>
                {w}
              </span>
            ))}
          </h1>
        </div>
        {g.boardShowFlight && g.flight && <p className="gb-flight">{g.flight}</p>}
      </div>
      <div className="gb-foot">
        {flashing ? (
          <span className="gb-live" role="status">
            <i /> {first(g.name)} is looking for you
          </span>
        ) : wantsLandscape && !landscape ? (
          <span className="gb-hint">
            <RotateCw size={16} /> Turn your phone sideways for a bigger sign
          </span>
        ) : null}
        {onSeeGuest && (
          <button className="gb-see" onClick={onSeeGuest}>
            <Check size={18} strokeWidth={2.6} /> I see {first(g.name)}
          </button>
        )}
      </div>
    </div>
  );
}
