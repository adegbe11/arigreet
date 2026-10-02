/* Find-My-style finding: one big arrow that points at the other person, with
   the distance. Uses both phones' GPS and this phone's compass, so it works in
   the app and in the passenger's browser. Accurate to a few metres outdoors;
   indoors it says so, and the GreetBoard and meeting point take over. */
import React, { useEffect, useRef, useState } from "react";
import { X, Compass, Maximize2, Zap, Check } from "lucide-react";
import { useApp, first, Avatar } from "./ui.jsx";
import { haptic } from "./native.js";

const R = Math.PI / 180;
export const metres = (a, b) => {
  const h =
    Math.sin(((b.latitude - a.latitude) * R) / 2) ** 2 +
    Math.cos(a.latitude * R) * Math.cos(b.latitude * R) * Math.sin(((b.longitude - a.longitude) * R) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
/* Compass bearing from a to b, 0 = north, clockwise. */
const bearing = (a, b) => {
  const y = Math.sin((b.longitude - a.longitude) * R) * Math.cos(b.latitude * R);
  const x =
    Math.cos(a.latitude * R) * Math.sin(b.latitude * R) -
    Math.sin(a.latitude * R) * Math.cos(b.latitude * R) * Math.cos((b.longitude - a.longitude) * R);
  return (Math.atan2(y, x) / R + 360) % 360;
};

/* The phone's compass heading in degrees, or null until it reports. iPhone
   needs a tap to allow it, so `ask` is returned for a button. */
function useHeading() {
  const [heading, setHeading] = useState(null);
  const [needsTap, setNeedsTap] = useState(
    typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function",
  );
  useEffect(() => {
    if (needsTap) return;
    let last = 0;
    const turn = () => (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
    const ios = (e) => {
      if (e.webkitCompassHeading == null) return;
      if (Date.now() - last < 60) return;
      last = Date.now();
      setHeading((e.webkitCompassHeading + turn()) % 360);
    };
    const abs = (e) => {
      if (e.alpha == null || (e.type === "deviceorientation" && !e.absolute)) return;
      if (Date.now() - last < 60) return;
      last = Date.now();
      setHeading((360 - e.alpha + turn()) % 360);
    };
    window.addEventListener("deviceorientation", ios);
    window.addEventListener("deviceorientationabsolute", abs);
    window.addEventListener("deviceorientation", abs);
    return () => {
      window.removeEventListener("deviceorientation", ios);
      window.removeEventListener("deviceorientationabsolute", abs);
      window.removeEventListener("deviceorientation", abs);
    };
  }, [needsTap]);
  const ask = () =>
    DeviceOrientationEvent.requestPermission()
      .then((r) => r === "granted" && setNeedsTap(false))
      .catch(() => {});
  return { heading, needsTap, ask };
}

/* Keeps the arrow turning the short way round (350° → 10° is +20°, not −340°). */
function useSmoothAngle(target) {
  const cur = useRef(target ?? 0);
  if (target != null) {
    const d = ((target - (cur.current % 360) + 540) % 360) - 180;
    cur.current += d;
  }
  return cur.current;
}

export default function Finder({ onClose }) {
  const a = useApp();
  const { g, role, isGuest, positions, now, t } = a;
  const peerName = isGuest ? g.greeter : g.name;
  const peer = first(peerName);
  const me = positions[role];
  const them = positions[isGuest ? "greeter" : "guest"];
  const peerPhoto = isGuest ? a.pickupPhoto(g, "greeter") : g.identification?.photo || g.photo;
  const { heading, needsTap, ask } = useHeading();

  const have = me && them;
  const d = have ? Math.round(metres(me, them)) : null;
  const toThem = have ? bearing(me, them) : null;
  const rel = toThem != null && heading != null ? (toThem - heading + 360) % 360 : null;
  const angle = useSmoothAngle(rel ?? toThem);
  const err = have ? Math.round(Math.max(me.accuracy || 0, them.accuracy || 0)) : 0;
  const weak = err > 25;
  const stale = have && now - Math.min(me.timestamp, them.timestamp) > 30000;
  // Never claim more precision than GPS has: "right here" only when the
  // distance plus the error still fits inside a few metres, and no arrow when
  // the error is as big as the distance itself (the arrow could point anywhere).
  const here = d != null && !stale && d + err <= 12;
  const blurry = d != null && !here && (stale || err >= d * 0.8);
  const aligned = !blurry && rel != null && (rel < 20 || rel > 340);

  const side =
    rel == null
      ? ""
      : rel < 20 || rel > 340
        ? t("Ahead")
        : rel < 160
          ? t("To your right")
          : rel <= 200
            ? t("Behind you")
            : t("To your left");

  // A light tap each time the arrow lines up, like Precision Finding.
  const was = useRef(false);
  useEffect(() => {
    if (aligned && !was.current) haptic("light");
    was.current = aligned;
  }, [aligned]);
  const wasHere = useRef(false);
  useEffect(() => {
    if (here && !wasHere.current) haptic("success");
    wasHere.current = here;
  }, [here]);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", k);
      document.body.style.overflow = o;
    };
  }, []);

  return (
    <div className={"fd " + (here ? "fd-here" : aligned ? "fd-aligned" : "")} role="dialog" aria-modal="true" aria-label={t("Find {peer}", { peer })}>
      <header className="fd-top">
        <Avatar name={peerName} src={peerPhoto} size={40} />
        <div>
          <small>{t("Finding")}</small>
          <b>{peerName}</b>
        </div>
        <button className="fd-x" onClick={onClose} aria-label={t("Close")}>
          <X size={22} />
        </button>
      </header>

      <main className="fd-main" aria-live="polite">
        {!have ? (
          <p className="fd-wait">{t("Waiting for {peer}’s location", { peer })}</p>
        ) : here ? (
          <>
            <span className="fd-pulse" aria-hidden="true" />
            <h2 className="fd-big">{t("Look up.")}</h2>
            <p className="fd-side">{t("{peer} is right here.", { peer })}</p>
          </>
        ) : blurry ? (
          <>
            <span className="fd-ring" aria-hidden="true" />
            <h2 className="fd-big fd-about">{t("Within about {n} m", { n: Math.max(d, err) })}</h2>
            <p className="fd-side">{t("Direction isn’t reliable here. Look for {place}.", { place: g.exit || g.area })}</p>
          </>
        ) : (
          <>
            <svg
              className="fd-arrow"
              viewBox="0 0 100 100"
              style={{ transform: `rotate(${angle}deg)` }}
              aria-hidden="true"
            >
              <path d="M50 6 L84 84 L50 66 L16 84 Z" />
            </svg>
            <h2 className="fd-big">
              {d}
              <span> m</span>
            </h2>
            <p className="fd-side">{side || (needsTap ? "" : t("Hold your phone flat and turn slowly."))}</p>
          </>
        )}
      </main>

      <footer className="fd-foot">
        {needsTap && have && !here && (
          <button className="btn lime" onClick={ask}>
            <Compass size={19} /> {t("Turn on compass")}
          </button>
        )}
        {(weak || stale) && have && !blurry && (
          <p className="fd-note">
            {stale
              ? t("Location hasn’t updated for a moment. Keep walking towards {place}.", { place: g.exit || g.area })
              : t("GPS is weak indoors. It may be off by about {n} m.", { n: err })}
          </p>
        )}
        <div className="fd-actions">
          {isGuest ? (
            <button className="btn soft" disabled={a.busy} onClick={() => a.run(() => a.action("flash"))}>
              <Zap size={18} /> {t("Flash my greeter")}
            </button>
          ) : (
            <button className="btn soft" onClick={() => a.setModal("board")}>
              <Maximize2 size={18} /> GreetBoard
            </button>
          )}
          <button className="btn soft" onClick={() => a.setModal("confirm")}>
            <Check size={18} /> {t("I see {peer}", { peer })}
          </button>
        </div>
      </footer>
    </div>
  );
}
