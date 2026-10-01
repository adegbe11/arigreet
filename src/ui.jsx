import React, { createContext, useContext, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const first = (name) => (name || "").trim().split(/\s+/)[0] || "";
export const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const airportName = (a) => (a || "").replace(/\s*\(.*\)/, "");
export const airportCode = (a) => (a || "").match(/\(([A-Z]{3})\)/i)?.[1]?.toUpperCase();
export const LIVE = ["PASSENGER_READY", "LIVE_GREET", "NEARBY", "VERY_CLOSE", "MEETING_CONFIRMATION"];
export const ENDED = ["COMPLETED", "CANCELLED", "EXPIRED"];

export function dayLabel(date) {
  if (!date) return "";
  const d = new Date(date + "T12:00");
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}
export const localDate = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
export const clock = (t) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/* Greeter-facing status for a Greet (spec §20–21, §47) */
export function statusOf(g) {
  const n = first(g.name) || "Guest";
  const map = {
    CREATED: ["Ready to send", "idle"],
    INVITATION_SENT: ["Link sent", "idle"],
    INVITATION_OPENED: [`${n} opened the link`, "idle"],
    PASSENGER_CONFIRMED: ["Waiting for arrival", "idle"],
    PRE_ARRIVAL: ["Waiting for arrival", "idle"],
    FLIGHT_IN_PROGRESS: ["In the air", "idle"],
    LANDED: [`${n} has landed`, "warn"],
    BAGGAGE_COLLECTION: ["Collecting baggage", "warn"],
    PASSENGER_READY: [`${n} is ready`, "live"],
    LIVE_GREET: ["Live Greet", "live"],
    NEARBY: [`${n} is nearby`, "live"],
    VERY_CLOSE: [`${n} is very close`, "live"],
    MEETING_CONFIRMATION: ["Confirming meeting", "live"],
    COMPLETED: ["Met ✓", "done"],
    CANCELLED: ["Cancelled", "off"],
    EXPIRED: ["Expired", "off"],
  };
  const fs = g.flightData?.status?.toLowerCase() || "";
  if (!LIVE.includes(g.state) && !ENDED.includes(g.state)) {
    if (fs.includes("cancel")) return ["Flight cancelled", "bad"];
    if (fs.includes("divert")) return ["Flight diverted", "bad"];
  }
  return map[g.state] || [g.state.replaceAll("_", " ").toLowerCase(), "idle"];
}

export function Status({ g }) {
  const [text, tone] = statusOf(g);
  return (
    <span className={"ui-status " + tone}>
      <i />
      {text}
    </span>
  );
}

export function Avatar({ name, src, size = 44, tone = "blue" }) {
  return src ? (
    <img className="ui-avatar" src={src} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className={"ui-avatar " + tone} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Plate({ children }) {
  return (
    <span className="plate">
      <i />
      {String(children || "").toUpperCase()}
    </span>
  );
}

export function Dots() {
  return <span className="ui-dots" aria-hidden="true">●●●</span>;
}

/* Native-feeling bottom sheet (centred dialog on wide screens) */
export function Sheet({ title, children, onClose, wide, label, tone = "" }) {
  const app = useContext(AppCtx);
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const esc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", esc);
    const f = requestAnimationFrame(() =>
      ref.current?.querySelector("input,textarea,button:not(.ui-sheet-x)")?.focus({ preventScroll: true }),
    );
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(f);
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = o;
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="ui-veil" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        className={"ui-sheet " + (wide ? "wide " : "") + tone}
      >
        <span className="ui-grab" />
        {onClose && (
          <button className="ui-sheet-x" onClick={onClose} aria-label={app?.t ? app.t("Close") : "Close"}>
            <X size={18} />
          </button>
        )}
        {title && <h2 className="ui-sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/* Spec §21 timeline */
export function Timeline({ g }) {
  const n = first(g.name);
  const reached = new Set(g.timeline.map((t) => t.state));
  const at = (s) => g.timeline.find((t) => t.state === s)?.at;
  const has = (...s) => s.some((x) => reached.has(x));
  const landed = g.flightData?.actual || has("LANDED");
  const steps = [
    ["Link sent", has("INVITATION_SENT", "INVITATION_OPENED") || g.state !== "CREATED", at("INVITATION_SENT")],
    [`${n} opened link`, has("INVITATION_OPENED"), at("INVITATION_OPENED")],
    [landed ? `${n} landed` : "Flight arriving", !!landed, g.flightData?.actual || at("LANDED")],
    [`${n} is collecting bags`, has("BAGGAGE_COLLECTION"), at("BAGGAGE_COLLECTION"), !has("BAGGAGE_COLLECTION")],
    [`${n} is ready`, has("PASSENGER_READY"), at("PASSENGER_READY")],
    ["Live Greet", has("LIVE_GREET", "NEARBY", "VERY_CLOSE"), at("LIVE_GREET")],
    ["Met", g.state === "COMPLETED", g.completedAt],
  ].filter((s) => !s[3]);
  const current = steps.findIndex((s) => !s[1]);
  return (
    <ol className="ui-timeline">
      {steps.map(([text, done, time], i) => (
        <li key={text} className={done ? "done" : i === current ? "now" : ""}>
          <span>{done ? <Check size={13} strokeWidth={3} /> : null}</span>
          <b>{text}</b>
          {done && time ? <small>{clock(time)}</small> : null}
        </li>
      ))}
    </ol>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="ui-empty">
      {Icon && (
        <span className="ui-empty-icon">
          <Icon size={26} />
        </span>
      )}
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/* Offline / poor connection banner (spec §51) */
export function ConnectionBanner({ online, error, onDismiss, t = (x) => x }) {
  if (online && !error) return null;
  return (
    <div className={"ui-banner " + (online ? "" : "offline")} role="status">
      <i />
      <span>{online ? error : t("You’re offline. Details on screen may be out of date.")}</span>
      {online && onDismiss && (
        <button onClick={onDismiss} aria-label={t("Dismiss")}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/* True once the page has scrolled — drives the iOS 27 scroll edge on bars */
export function useScrolled(at = 4) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const f = () => setOn(window.scrollY > at);
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, [at]);
  return on;
}
