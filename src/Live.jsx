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
import { isNative } from "./native.js";
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
  const findBtn = (cls) =>
    canFind && (
      <button className={"btn lv-find " + cls} onClick={() => a.setModal("finder")}>
        <LocateFixed size={20} /> {t("Find {peer}", { peer })}
      </button>
    );
  const sos = isGuest && (
    <div className="gs-sos">
      <button onClick={() => a.setModal("help")}>{t("I can’t find {peer}", { peer })}</button>
    </div>
  );
  const see = () => a.setModal("confirm");

  /* Meeting confirmation waiting states (spec §42) */
  if (g.state === "MEETING_CONFIRMATION")
    return (
      <section className="lv lv-confirm">
        <span className="lv-hand">👋</span>
        {iConfirmed ? (
          <>
            <h2>{t("Waiting for {peer}", { peer })}</h2>
            <p>{t("You confirmed you’ve met. {peer} needs to confirm too.", { peer })}</p>
            <p className="lv-auto">{t("If {peer} forgets, this closes by itself in 10 minutes.", { peer })}</p>
            <button className="btn ghost" onClick={() => a.run(() => a.action("state", "LIVE_GREET"))} disabled={busy}>
              {t("We haven’t met yet")}
            </button>
          </>
        ) : (
          <>
            <h2>{t("{peer} says you’ve met", { peer })}</h2>
            <p>{t("Did you find each other?")}</p>
            <button className="btn primary" disabled={busy} onClick={() => a.run(() => a.action("confirm"))}>
              {t("Yes, we’ve met")}
            </button>
            <button className="btn ghost" onClick={() => a.run(() => a.action("state", "LIVE_GREET"))} disabled={busy}>
              {t("Not yet")}
            </button>
          </>
        )}
      </section>
    );

  const actions = (
    <div className="lv-actions">
      {(isGuest ? g.allowCall && g.contact : g.phone) ? (
        <a href={"tel:" + (isGuest ? g.contact : g.phone)}>
          <Phone size={21} />
          {t("Call")}
        </a>
      ) : (
        <button disabled title={t("No phone number on this Greet")}>
          <Phone size={21} />
          {t("Call")}
        </button>
      )}
      {!isGuest && (
        <button onClick={() => a.setModal("board")}>
          <Maximize2 size={20} />
          GreetBoard
        </button>
      )}
      <button onClick={() => a.setModal("meeting")}>
        <MapPin size={21} />
        {t("Meeting point")}
      </button>
    </div>
  );

  /* Very close — stop staring at the map (spec §41) */
  if (veryClose)
    return (
      <section className="lv lv-close">
        <div className="lv-look">
          {isGuest ? (
            <>
              <span className="lv-hand">👋</span>
              <h2>{t("Look up")}</h2>
              <p>{t("{peer} is very close.", { peer })}</p>
              <div className="lv-beacon">
                {t("Look for")} <b>{beacon}</b> <span>●●●</span>
              </div>
            </>
          ) : (
            <>
              <h2>{peer} is very close.</h2>
              {peerPhoto ? <img className="lv-guest-photo" src={peerPhoto} alt={g.name} /> : null}
              {lookFor.length ? (
                <ul className="lv-lookfor">
                  <li className="lbl">Look for</li>
                  {lookFor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p>Hold up your GreetBoard so {peer} can see it.</p>
              )}
            </>
          )}
        </div>
        {isGuest ? (
          <button className="btn lime" disabled={busy} onClick={flash}>
            <Zap size={20} /> {t("Flash my greeter")}
          </button>
        ) : (
          <button className="btn primary" onClick={() => a.setModal("board")}>
            <Maximize2 size={19} /> SHOW GREETBOARD
          </button>
        )}
        <button className="btn ink" onClick={see}>
          <Check size={19} strokeWidth={2.6} /> {t("I SEE {peer}", { peer: peer.toUpperCase() })}
        </button>
        {findBtn("soft")}
        {isGuest && flashing && (
          <p className="lv-flashing" role="status">
            {t("Your greeter is flashing. Look for {beacon}", { beacon })} ●●●
          </p>
        )}
        {actions}
        {sos}
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
              : nearby
                ? t("{peer} is nearby.", { peer })
                : t("{peer} is {n} m away", { peer, n: distance });
  return (
    <section className={"lv " + (nearby ? "lv-near" : "")}>
      <div className="lv-card" aria-live="polite">
        <Avatar name={peerName} src={peerPhoto} size={48} />
        <div>
          {nearby && distance !== null ? (
            <>
              <b className="lv-near-title">{t("{peer} is nearby.", { peer })}</b>
              <span className="lv-metres">{distance} m</span>
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
            </>
          )}
          {approaching && signal === "ok" && !nearby && (
            <span className="lv-moving">
              <Navigation size={13} /> {t("Moving toward you")}
            </span>
          )}
        </div>
      </div>

      {findBtn(nearby ? "primary" : "soft")}

      {isGuest && sharing && !isNative && (
        <p className="lv-keep">
          <Smartphone size={15} /> {t("Keep this page open so {peer} can follow you to the exit.", { peer })}
        </p>
      )}

      {nearby && (
        <div className="lv-nearby">
          {isGuest ? (
            <div className="lv-beacon">
              {t("Look for")} <b>{beacon}</b> <span>●●●</span>
            </div>
          ) : lookFor.length || peerPhoto ? (
            <div className="lv-lookfor-row">
              {peerPhoto && <img src={peerPhoto} alt="" />}
              <ul className="lv-lookfor">
                <li className="lbl">Look for</li>
                {lookFor.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {isGuest ? (
            <button className="btn lime" disabled={busy} onClick={flash}>
              <Zap size={20} /> {t("Flash my greeter")}
            </button>
          ) : (
            <button className="btn primary" onClick={() => a.setModal("board")}>
              <Maximize2 size={19} /> SHOW GREETBOARD
            </button>
          )}
          {isGuest && flashing && (
            <p className="lv-flashing" role="status">
              {t("Your greeter is flashing. Look for {beacon}", { beacon })} ●●●
            </p>
          )}
        </div>
      )}

      <div className={"lv-map " + (nearby ? "small" : "")}>
        {me || them ? (
          <Suspense fallback={<div className="lv-map-empty">{t("Loading map…")}</div>}>
            <LiveMap id={g.id} positions={positions} role={role} peer={peerName} peerPhoto={peerPhoto} />
          </Suspense>
        ) : (
          <div className="lv-map-empty">
            {sharing ? <Navigation size={26} /> : <LocateOff size={26} />}
            <b>{sharing ? t("Finding your location…") : t("Location is off")}</b>
            <span>
              {t("Meet at {place}", { place: [g.area, g.exit, g.landmark].filter(Boolean).join(" · ") })}
            </span>
          </div>
        )}
      </div>

      {actions}

      {!nearby && (
        <button className="btn ink" onClick={see}>
          <Check size={19} strokeWidth={2.6} /> {t("I see {peer}", { peer })}
        </button>
      )}
      {nearby && (
        <button className="btn ghost" onClick={see}>
          <Check size={18} strokeWidth={2.6} /> {t("I see {peer}", { peer })}
        </button>
      )}

      {/* Indoors this beats GPS: both people say where they are. */}
      <button
        className={"btn " + (atPoint ? "lime" : "soft") + " lv-atpoint"}
        aria-pressed={!!atPoint}
        disabled={busy}
        onClick={() => a.run(() => a.action("meeting-point", { atPoint: !atPoint }))}
      >
        {atPoint ? <Check size={19} strokeWidth={2.6} /> : <MapPin size={19} />}
        {atPoint ? t("You’re at {place}", { place: g.exit || g.area }) : t("I’m at {place}", { place: g.exit || g.area })}
      </button>
      <div className="lv-foot">
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
      {sos}
    </section>
  );
}
