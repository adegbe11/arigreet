import React, { useState } from "react";
import {
  Phone,
  MapPin,
  Plane,
  Car,
  ChevronRight,
  UserRound,
  Check,
  Link2Off,
  Clock,
  Ban,
  WifiOff,
  Briefcase,
  Star,
  Globe,
} from "lucide-react";
import { useApp, useScrolled, first, Avatar, Plate, dayLabel, airportName, LIVE, clock } from "./ui.jsx";
import { PinMark, Wordmark } from "./Brand.jsx";
import { LANGS } from "./i18n.js";
import Live from "./Live.jsx";

// "Today", "Tomorrow" or a date, in the passenger's language.
const day = (date, a) => {
  if (!date) return "";
  const d = new Date(date + "T12:00");
  const diff = Math.round((d - new Date(new Date().toDateString() + " 12:00")) / 86400000);
  if (diff === 0) return a.t("Today");
  if (diff === 1) return a.t("Tomorrow");
  return d.toLocaleDateString(a.lang, { weekday: "short", day: "numeric", month: "short" });
};

const landedFlight = (g) =>
  !!(g.flightData?.actual || /landed|arrived/i.test(g.flightData?.status || ""));
// The passenger said so, or the flight data did.
const hasLanded = (g) => landedFlight(g) || ["LANDED", "BAGGAGE_COLLECTION"].includes(g.state);
const beforeArrival = (g, now) => {
  if (landedFlight(g)) return false;
  const eta = g.flightData?.estimated ? new Date(g.flightData.estimated).getTime() : Date.parse(`${g.date}T${g.time || "00:00"}`);
  return Number.isFinite(eta) && eta - 20 * 60000 > now;
};

function GuestHeader() {
  const scrolled = useScrolled();
  const a = useApp();
  return (
    <header className={"gs-head" + (scrolled ? " is-scrolled" : "")}>
      <span className="gs-brand">
        <PinMark size={24} />
        <Wordmark />
      </span>
      <label className="gs-lang">
        <Globe size={16} aria-hidden="true" />
        <span className="sr-only">{a.t("Language")}</span>
        <select value={a.lang} onChange={(e) => a.setLang(e.target.value)}>
          {LANGS.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}

export function GuestProblem({ fail, busy }) {
  const { t } = useApp();
  const status = fail?.status;
  const msg = fail?.message || "";
  const [Icon, title, text] = !fail
    ? [null, t("Opening your pickup…"), ""]
    : /cancel/i.test(msg)
      ? [Ban, t("This Greet was cancelled"), t("Your greeter cancelled this pickup. Contact them if you still need a ride.")]
      : status === 410
        ? [Clock, t("This link has expired"), t("Ask the person meeting you to send a new Arigreet link.")]
        : status === 404
          ? [Link2Off, t("This link isn’t valid"), t("Check you opened the full link from your greeter’s message, or ask them to send it again.")]
          : [WifiOff, t("Can’t reach Arigreet"), t("Check your connection and try again. Your meeting point is in your greeter’s message.")];
  return (
    <div className="gs gs-center">
      <GuestHeader />
      <div className="gs-problem">
        {Icon ? (
          <span className="gs-problem-icon">
            <Icon size={28} />
          </span>
        ) : (
          <span className="gs-spinner" aria-hidden="true" />
        )}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {fail && !status && (
          <button className="btn primary" onClick={() => location.reload()}>
            {t("Try again")}
          </button>
        )}
      </div>
    </div>
  );
}

function Invitation({ g, onView }) {
  const a = useApp();
  const { t } = a;
  return (
    <div className="gs gs-invite">
      <GuestHeader />
      <div className="gs-invite-body">
        <Avatar name={g.greeter} src={a.pickupPhoto(g, "greeter")} size={96} />
        <h1>{t("{peer} is meeting you.", { peer: first(g.greeter) })}</h1>
        <div className="gs-invite-meta">
          <b>{t("{city} Airport", { city: airportName(g.airport) })}</b>
          <span>
            {day(g.date, a)} · {g.time}
          </span>
        </div>
        <p>{t("When you’re ready, Arigreet will help you find each other.")}</p>
      </div>
      <div className="gs-bottom">
        <button className="btn primary" onClick={onView}>
          {t("View my pickup")}
        </button>
        <small>
          {t("No app or account required.")} <a href="/privacy">{t("Privacy")}</a>
        </small>
      </div>
    </div>
  );
}

function ArrivalCard({ g }) {
  const a = useApp();
  const { t } = a;
  const [ready, setReady] = useState(false);
  const peer = first(g.greeter);
  const guest = first(g.name);
  const city = airportName(g.airport);
  const go = () => a.setModal("permission");
  if (a.offlinePickup) return null;
  if (ready)
    return (
      <section className="gs-card gs-ready">
        <h2>{t("Ready to meet {peer}?", { peer })}</h2>
        <p>{t("When you tap I’m Ready, Arigreet can help you find each other.")}</p>
        <button className="btn primary huge" onClick={go}>
          {t("I’m ready")}
        </button>
        <small className="gs-note">{t("Shares your live location with {peer} until you meet.", { peer })}</small>
      </section>
    );
  if (g.state === "BAGGAGE_COLLECTION")
    return (
      <section className="gs-card">
        <span className="gs-card-icon">
          <Briefcase size={22} />
        </span>
        <h2>{t("Take your time.")}</h2>
        <p>{t("{peer} knows you’re collecting your bags.", { peer })}</p>
        <button className="btn primary" onClick={() => setReady(true)}>
          {t("I have my bags")}
        </button>
      </section>
    );
  // Spec: every update is one tap. "I've landed" tells the greeter straight away.
  if (!hasLanded(g))
    return (
      <section className="gs-card">
        <h2>{beforeArrival(g, a.now) ? t("{peer} is meeting you.", { peer }) : t("Landed in {city}?", { city })}</h2>
        <p>{t("Tap when your plane is on the ground. {peer} will know right away.", { peer })}</p>
        <button className="btn primary huge" disabled={a.busy} onClick={() => a.run(() => a.action("state", "LANDED"))}>
          {t("I’ve landed")}
        </button>
        <small className="gs-note">{t("Nothing else is shared until you tap I’m Ready.")}</small>
      </section>
    );
  return (
    <section className="gs-card">
      {hasLanded(g) && (
        <p className="gs-welcome">
          {t("Welcome to {city}, {guest}.", { city, guest })}
        </p>
      )}
      <h2>{t("Have you collected your bags?")}</h2>
      <p>{t("No checked bags? Tap Yes.")}</p>
      <div className="gs-stack">
        <button className="btn primary" onClick={() => setReady(true)}>
          {t("Yes, I have my bags")}
        </button>
        <button className="btn ghost" disabled={a.busy} onClick={() => a.run(() => a.action("state", "BAGGAGE_COLLECTION"))}>
          {t("Still waiting for bags")}
        </button>
      </div>
    </section>
  );
}

/* What the greeter said last: the passenger's biggest worry is whether anyone is there. */
function Presence({ g, now }) {
  const { t } = useApp();
  const peer = first(g.greeter);
  const st = g.greeterStatus;
  if (!st) return null; // nothing said yet: the card below already says who is meeting you
  const [text, tone] = {
        ON_MY_WAY: [t("{peer} is on the way to the airport", { peer }), "go"],
        LATE_10: [t("{peer} is running about {n} minutes late", { peer, n: 10 }), "late"],
        LATE_20: [t("{peer} is running about {n} minutes late", { peer, n: 20 }), "late"],
        LATE_30: [t("{peer} is running about {n} minutes late", { peer, n: 30 }), "late"],
        AT_ARRIVALS: [t("{peer} is at Arrivals with your name", { peer }), "here"],
      }[st.code] || ["", "idle"];
  if (!text) return null;
  const mins = Math.max(0, Math.round((now - st.at) / 60000));
  return (
    <div className={"gs-presence " + tone} role="status">
      <i />
      <span>
        <b>{text}</b>
        <small>{mins < 1 ? t("Just now") : t("{n} min ago", { n: mins })}</small>
      </span>
    </div>
  );
}

function Pickup({ g }) {
  const a = useApp();
  const { t } = a;
  const peer = first(g.greeter);
  const fs = g.flightData;
  const delayed =
    fs?.estimated && g.time && new Date(fs.estimated).getTime() - Date.parse(`${g.date}T${g.time}`) > 15 * 60000;
  const photo = a.pickupPhoto(g, "greeter");
  const vehiclePhoto = a.pickupPhoto(g, "vehicle");
  return (
    <div className="gs">
      <GuestHeader />
      {a.offlinePickup && (
        <div className="gs-offline" role="status">
          <WifiOff size={16} />{" "}
          {t("Saved pickup · downloaded {when}. Details may have changed.", {
            when: new Date(a.cachedAt).toLocaleString(a.lang, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
          })}
        </div>
      )}
      <section className="gs-greeter">
        <Avatar name={g.greeter} src={photo} size={88} />
        <div>
          <small>{t("Your greeter")}</small>
          <h1>{g.greeter}</h1>
          {g.company && <span>{g.company}</span>}
        </div>
      </section>
      {!a.offlinePickup && g.allowCall && g.contact && (
        <a className="btn soft" href={"tel:" + g.contact}>
          <Phone size={19} /> {t("Call {peer}", { peer })}
        </a>
      )}
      {!a.offlinePickup && <Presence g={g} now={a.now} />}
      <ArrivalCard g={g} />
      {!a.offlinePickup && hasLanded(g) && (
        <div className="gs-sos">
          <button onClick={() => a.setModal("help")}>{t("I can’t find {peer}", { peer })}</button>
        </div>
      )}
      <section className="gs-list">
        <div>
          <MapPin size={20} />
          <span>
            <small>{t("Meeting point")}</small>
            <b>{[g.area, g.exit].filter(Boolean).join(" · ")}</b>
            {(g.instructions || g.landmark) && <p>{g.instructions || g.landmark}</p>}
          </span>
        </div>
        {g.vehicle && (
          <div>
            <Car size={20} />
            <span>
              <small>{t("Vehicle")}</small>
              <b>{[g.colour, g.vehicle].filter(Boolean).join(" ")}</b>
              {g.plate && <Plate>{g.plate}</Plate>}
              {vehiclePhoto && <img className="gs-vehicle" src={vehiclePhoto} alt={g.vehicle} />}
            </span>
          </div>
        )}
        <div>
          <Plane size={20} />
          <span>
            <small>{t("Flight")}</small>
            <b>{g.flight ? [g.flight, airportName(g.airport)].filter(Boolean).join(" · ") : t("{city} Airport", { city: airportName(g.airport) })}</b>
            <p>
              {[day(g.date, a), g.time, g.terminal].filter(Boolean).join(" · ")}
              {delayed && (
                <em className="gs-late">
                  {" "}
                  · {t("Now {time}", { time: new Date(fs.estimated).toLocaleTimeString(a.lang, { hour: "2-digit", minute: "2-digit" }) })}
                </em>
              )}
            </p>
            {/cancel/i.test(fs?.status || "") && <p className="gs-bad">{t("Flight cancelled. Call {peer} to rearrange.", { peer })}</p>}
          </span>
        </div>
      </section>
      {!a.offlinePickup && (
        <button className="gs-row" onClick={() => a.setModal("identify")}>
          <span className="gs-row-icon">
            <UserRound size={20} />
          </span>
          <span>
            <b>{t("Help {peer} recognize you", { peer })}</b>
            <small>{g.identification?.wearing || g.identification?.photo ? t("Added · tap to change") : t("Optional")}</small>
          </span>
          <ChevronRight size={20} />
        </button>
      )}
      {a.offlinePickup && (
        <button className="btn ghost" onClick={() => location.reload()}>
          {t("Try reconnecting")}
        </button>
      )}
    </div>
  );
}

function Complete({ g }) {
  const a = useApp();
  const { t } = a;
  const [rated, setRated] = useState(g.rating || 0);
  const [done, setDone] = useState(false);
  return (
    <div className="gs gs-center">
      <GuestHeader />
      <div className="gs-done">
        <span className="gs-check">
          <Check size={44} strokeWidth={3} />
        </span>
        <h1>{t("You’re together.")}</h1>
        <p>{t("Pickup complete.")}</p>
        <p className="gs-safe">{t("Location sharing has stopped.")}</p>
        {!done ? (
          <>
            <div className="gs-rate" role="radiogroup" aria-label={t("Rate your experience")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={rated === n}
                  aria-label={t("{n} stars", { n })}
                  className={n <= rated ? "on" : ""}
                  onClick={() => {
                    setRated(n);
                    a.api("/greets/" + g.id + "/action", { action: "rate", value: n }).catch(() => {});
                  }}
                >
                  <Star size={26} />
                </button>
              ))}
            </div>
            <small>{rated ? t("Thanks for rating.") : t("Rate your experience (optional)")}</small>
            <button className="btn primary" onClick={() => setDone(true)}>
              {t("Done")}
            </button>
          </>
        ) : (
          <p className="gs-bye">{t("Enjoy your trip, {guest}. You can close this page.", { guest: first(g.name) })}</p>
        )}
      </div>
    </div>
  );
}

export default function Guest() {
  const a = useApp();
  const { g, guestView, setGuestView } = a;
  if (!g) return <GuestProblem fail={a.guestFail} busy={a.busy} />;
  if (g.state === "COMPLETED") return <Complete g={g} />;
  if (LIVE.includes(g.state) && !a.offlinePickup)
    return (
      <div className="gs gs-live">
        <GuestHeader />
        <h1 className="sr-only">{a.t("Finding {peer}", { peer: first(g.greeter) })}</h1>
        <Live />
      </div>
    );
  if (guestView === "welcome") return <Invitation g={g} onView={() => setGuestView("details")} />;
  return <Pickup g={g} />;
}
