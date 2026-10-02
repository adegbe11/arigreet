import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Phone,
  MapPin,
  Maximize2,
  Zap,
  Check,
  Navigation,
  LocateOff,
  Signal,
  LocateFixed,
  Smartphone,
} from "lucide-react";
import { isNative, haptic } from "./native.js";
import { useApp, first, Avatar } from "./ui.jsx";

const LiveMap = lazy(() => import("./LiveMap.jsx"));
const dist = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const eta = (m, t) => (m < 40 ? t("Less than a minute") : t("About {n} min", { n: Math.max(1, Math.round(m / 75)) }));

/* Tracks whether the other person is really moving toward you (spec §33). */
function useApproach(me, them) {
  const hist = useRef([]);
  const [approaching, setApproaching] = useState(false);
  useEffect(() => {
    if (!me || !them) return;
    const h = hist.current;
    if (!h.length || h.at(-1).timestamp !== them.timestamp) h.push(them);
    while (h.length > 6) h.shift();
    const old = h.find((p) => them.timestamp - p.timestamp >= 8000 && them.timestamp - p.timestamp <= 60000);
    setApproaching(
      !!old && them.accuracy <= 20 && dist(me, old) - dist(me, them) >= Math.max(8, them.accuracy),
    );
  }, [me?.latitude, me?.longitude, them?.timestamp]);
  return approaching;
}

export default function Live() {
  const a = useApp();
  const { g, role, isGuest, now, positions, distance, fresh, accurate, sharing, busy, t } = a;
  const peerName = isGuest ? g.greeter : g.name;
  const peer = first(peerName);
  const me = positions[role];
  const them = positions[isGuest ? "greeter" : "guest"];
  const approaching = useApproach(me, them);
  const beacon = `${g.beacon || "Klein Blue"}`;
  const flashing = now - (g.flashAt || 0) < 8000;
  const reported = (r) => r?.atPoint && now - r.at < 10 * 60000;
  const nearby = ["NEARBY", "VERY_CLOSE"].includes(g.state) && (fresh || reported(g.meetingIntent) || reported(g.greeterIntent));
  const veryClose = g.state === "VERY_CLOSE" && nearby;
  const iConfirmed = g.confirmations.includes(role);
  const theyConfirmed = g.confirmations.length > 0 && !iConfirmed;
  const atPoint = reported(isGuest ? g.meetingIntent : g.greeterIntent);
  const ident = g.identification || {};
  const lookFor = [ident.wearing, ident.bagDescription, ident.other].filter(Boolean);
  const peerPhoto = isGuest ? a.pickupPhoto(g, "greeter") : ident.photo || g.photo;

  const peerRole = isGuest ? "greeter" : "guest";
  const theyStopped = !them && g.stopped?.[peerRole];
  const staleThem = them && now - them.timestamp >= 30000;
  const signal =
    distance === null
      ? them
        ? "mine"
        : theyStopped
          ? "stopped"
          : "theirs"
      : !fresh
        ? staleThem
          ? "weak"
          : "mineweak"
        : !accurate
          ? "approx"
          : "ok";
  const ago = them ? Math.max(1, Math.round((now - them.timestamp) / 60000)) : 0;

  const flash = () => a.run(() => a.action("flash"));
  const canFind = !!(me && them);
  const sos = isGuest && (
    <div className="gs-sos">
      <button onClick={() => a.setModal("help")}>{t("I can’t find {peer}", { peer })}</button>
    </div>
  );
  const see = () => a.setModal("confirm");

  // One quiet tap as each stage arrives: nearby, then look up.
  const stage = veryClose ? 2 : nearby ? 1 : 0;
  const lastStage = useRef(stage);
  useEffect(() => {
    if (stage > lastStage.current) haptic(stage === 2 ? "success" : "light");
    lastStage.current = stage;
  }, [stage]);
  const call = (isGuest ? g.allowCall && g.contact : g.phone) ? "tel:" + (isGuest ? g.contact : g.phone) : null;
  const place = g.exit || g.area;
  const flashBtn = (cls = "lime") => (
    <button className={"btn " + cls} disabled={busy} onClick={flash}>
      <Zap size={19} /> {t("Flash my greeter")}
    </button>
  );
  const boardBtn = (cls = "primary") => (
    <button className={"btn " + cls} onClick={() => a.setModal("board")}>
      <Maximize2 size={19} /> Show GreetBoard
    </button>
  );
  const seeBtn = (cls) => (
    <button className={"btn " + cls} onClick={see}>
      <Check size={19} strokeWidth={2.6} /> {t("I see {peer}", { peer })}
    </button>
  );
  /* Small tools, never more than one row: the person should be walking, not reading. */
  const tools = (withFind) => (
    <div className="lv-actions">
      {withFind && canFind && (
        <button onClick={() => a.setModal("finder")}>
          <LocateFixed size={20} />
          {t("Find {peer}", { peer })}
        </button>
      )}
      {call && (
        <a href={call}>
          <Phone size={20} />
          {t("Call")}
        </a>
      )}
      <button onClick={() => a.setModal("meeting")}>
        <MapPin size={20} />
        {t("Meeting point")}
      </button>
    </div>
  );
  const recognise = isGuest ? (
    <div className="lv-beacon">
      {t("Look for")} <b>{beacon}</b> <span aria-hidden="true">●●●</span>
    </div>
  ) : lookFor.length || peerPhoto ? (
    <div className="lv-lookfor-row">
      {peerPhoto && <img src={peerPhoto} alt="" />}
      {lookFor.length > 0 && (
        <ul className="lv-lookfor">
          <li className="lbl">Look for</li>
          {lookFor.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
  const flashNote = isGuest && flashing && (
    <p className="lv-flashing" role="status">
      {t("Your greeter is flashing. Look for {beacon}", { beacon })} ●●●
    </p>
  );

  /* Confirming (spec §42). Whoever confirms stops sharing at once. */
  if (g.state === "MEETING_CONFIRMATION")
    return (
      <section className="lv lv-confirm">
        <span className="lv-done-mark" aria-hidden="true">
          <Check size={30} strokeWidth={3} />
        </span>
        {iConfirmed ? (
          <>
            <h2>{t("Waiting for {peer}", { peer })}</h2>
            <p>{t("You confirmed you’ve met. {peer} needs to confirm too.", { peer })}</p>
            <p className="lv-auto">{t("Your location is no longer shared.")}</p>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => a.run(() => a.action("state", "LIVE_GREET")).then(() => a.locationStart())}
            >
              {t("We haven’t met yet")}
            </button>
          </>
        ) : (
          <>
            <h2>{t("{peer} says you’ve met", { peer })}</h2>
            <p>{t("Did you find each other?")}</p>
            <button className="btn primary" disabled={busy} onClick={() => a.confirmMet()}>
              {t("Yes, we’ve met")}
            </button>
            <button className="btn ghost" onClick={() => a.run(() => a.action("state", "LIVE_GREET"))} disabled={busy}>
              {t("Not yet")}
            </button>
          </>
        )}
      </section>
    );

  /* Very close: stop looking at the phone. One instruction, the face to look
     for, and the one thing that makes the greeter easy to spot. */
  if (veryClose)
    return (
      <section className="lv lv-close" aria-live="polite">
        <div className="lv-look">
          <Avatar name={peerName} src={peerPhoto} size={88} />
          <h2>{t("Look up")}</h2>
          <p>{t("{peer} is very close.", { peer })}</p>
          {recognise}
        </div>
        {isGuest ? (
          <>
            {seeBtn("primary")}
            {flashBtn("lime")}
          </>
        ) : (
          <>
            {boardBtn("primary")}
            {seeBtn("soft")}
          </>
        )}
        {flashNote}
        <div className="lv-quiet">
          {call && <a href={call}>{t("Call")}</a>}
          {isGuest && <button onClick={() => a.setModal("help")}>{t("I can’t find {peer}", { peer })}</button>}
        </div>
      </section>
    );

  const headline =
    signal === "theirs"
      ? t("Waiting for {peer}’s location", { peer })
      : signal === "stopped"
        ? t("{peer} stopped sharing location", { peer })
        : signal === "mine"
          ? sharing
            ? t("Finding your location…")
            : t("Your location is off")
          : signal === "weak"
            ? t("{peer}’s location hasn’t updated for {n} min", { peer, n: ago })
            : signal === "mineweak"
              ? t("Your location isn’t updating")
              : t("{peer} is {n} m away", { peer, n: distance });

  const card = (
    <div className="lv-card" aria-live="polite">
      <Avatar name={peerName} src={peerPhoto} size={48} />
      <div>
        {nearby ? (
          <>
            <b className="lv-near-title">{t("{peer} is nearby.", { peer })}</b>
            {distance !== null && fresh && (
              <span className="lv-metres">
                {accurate ? "" : "~"}
                {distance} m
              </span>
            )}
          </>
        ) : (
          <>
            <b>{headline}</b>
            {signal === "ok" && <span className="lv-sub">{eta(distance, t)}</span>}
            {signal === "approx" && (
              <span className="lv-sub">
                <Signal size={14} /> {t("Approximate location")} · {eta(distance, t)}
              </span>
            )}
            {["weak", "theirs", "mine", "stopped", "mineweak"].includes(signal) && (
              <span className="lv-sub">{t("Meet at {place}", { place: [g.area, g.exit].filter(Boolean).join(" · ") })}</span>
            )}
            {signal === "mine" && !sharing && (
              <button className="lv-inline" onClick={() => a.setModal("permission")}>
                {t("Share my location")}
              </button>
            )}
            {approaching && signal === "ok" && (
              <span className="lv-moving">
                <Navigation size={13} /> {t("Moving toward you")}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );

  const atPointBtn = (
    <button
      className={"lv-point " + (atPoint ? "on" : "")}
      aria-pressed={!!atPoint}
      disabled={busy}
      onClick={() => a.run(() => a.action("meeting-point", { atPoint: !atPoint }))}
    >
      {atPoint ? <Check size={16} strokeWidth={2.6} /> : <MapPin size={16} />}
      {atPoint ? t("You’re at {place}", { place }) : t("I’m at {place}", { place })}
    </button>
  );
  const foot = (
    <div className="lv-foot">
      {atPointBtn}
      {sharing ? (
        <button className="lv-stop" disabled={busy} onClick={a.stopSharing}>
          <i /> {t("Stop sharing")}
        </button>
      ) : (
        <button className="lv-stop off" onClick={() => a.setModal("permission")}>
          <LocateOff size={15} /> {t("Share location")}
        </button>
      )}
    </div>
  );
  const keepOpen = isGuest && sharing && !isNative && (
    <p className="lv-keep">
      <Smartphone size={15} /> {t("Keep this page open so {peer} can follow you to the exit.", { peer })}
    </p>
  );

  /* Nearby: the map shrinks; recognition and direction take over. */
  if (nearby)
    return (
      <section className="lv lv-near">
        {card}
        {recognise}
        {isGuest ? flashBtn("lime") : boardBtn("primary")}
        {seeBtn("soft")}
        {flashNote}
        <div className="lv-map small">
          {me || them ? (
            <Suspense fallback={<div className="lv-map-empty">{t("Loading map…")}</div>}>
              <LiveMap id={g.id} positions={positions} role={role} peer={peerName} peerPhoto={peerPhoto} />
            </Suspense>
          ) : null}
        </div>
        {tools(true)}
        {foot}
        {sos}
      </section>
    );

  /* Far: the map does the work. Everything else stays small. */
  return (
    <section className="lv">
      {card}
      {keepOpen}
      <div className="lv-map">
        {me || them ? (
          <Suspense fallback={<div className="lv-map-empty">{t("Loading map…")}</div>}>
            <LiveMap id={g.id} positions={positions} role={role} peer={peerName} peerPhoto={peerPhoto} />
          </Suspense>
        ) : (
          <div className="lv-map-empty">
            {sharing ? <Navigation size={26} /> : <LocateOff size={26} />}
            <b>{sharing ? t("Finding your location…") : t("Location is off")}</b>
            <span>{t("Meet at {place}", { place: [g.area, g.exit, g.landmark].filter(Boolean).join(" · ") })}</span>
          </div>
        )}
      </div>
      {tools(true)}
      {seeBtn("soft")}
      {foot}
      {sos}
    </section>
  );
}
