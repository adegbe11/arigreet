import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Handshake,
  User,
  Plus,
  ChevronRight,
  ChevronLeft,
  Plane,
  MapPin,
  Car,
  Maximize2,
  Phone,
  Pencil,
  XCircle,
  Send,
  Search,
  Bell,
  Check,
  Camera,
  Building2,
  Mail,
  Globe,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  Trash2,
  Clock,
  Link2,
  UserRound,
  PlaneLanding,
} from "lucide-react";
import {
  useApp,
  first,
  Avatar,
  Plate,
  Status,
  Timeline,
  Empty,
  Sheet,
  dayLabel,
  airportName,
  airportCode,
  LIVE,
  ENDED,
  localDate,
  clock,
} from "./ui.jsx";
import { GreetBoardPreview, BOARD_STYLES } from "./CreateFlow.jsx";
import Live from "./Live.jsx";

const TABS = [
  ["home", Home, "Home"],
  ["greets", Handshake, "Greets"],
  ["profile", User, "Profile"],
];

function shrink(file, max = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(Error("That photo couldn't be opened."));
    img.src = URL.createObjectURL(file);
  });
}

export function GreetCard({ g, onOpen }) {
  const live = LIVE.includes(g.state);
  return (
    <button className={"gc " + (live ? "live" : "")} onClick={() => onOpen(g)}>
      <Avatar name={g.name} src={g.photo} size={46} />
      <span className="gc-main">
        <b>{g.name}</b>
        <small>
          {[g.flight, airportName(g.airport)].filter(Boolean).join(" · ")}
        </small>
        <Status g={g} />
      </span>
      <span className="gc-when">
        <b>{g.time}</b>
        <small>{dayLabel(g.date)}</small>
      </span>
    </button>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/* First run, the Apple way: one short line and one button. The welcome
   screen already explained the app; Home gets straight to the action. */
function FirstRun({ onCreate }) {
  return (
    <section className="gr-first" aria-labelledby="first-title">
      <span className="gr-first-icon" aria-hidden="true">
        <PlaneLanding size={28} />
      </span>
      <h2 id="first-title">Who’s landing?</h2>
      <p>Add their flight and we’ll give you one link to send them.</p>
      <button className="btn primary gr-create" onClick={onCreate}>
        Create Greet
      </button>
    </section>
  );
}

function HomeTab() {
  const a = useApp();
  const today = localDate();
  const open = a.greets.filter((g) => !ENDED.includes(g.state));
  const active = open.filter((g) => LIVE.includes(g.state) || (g.date <= today && g.state !== "CREATED") || g.date < today);
  const todays = open.filter((g) => g.date === today && !active.includes(g));
  const upcoming = open.filter((g) => g.date > today && !active.includes(g)).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const ready = a.greets.filter((g) => g.state === "PASSENGER_READY");
  const name = first(a.profile?.name || a.session?.user?.name);
  const section = (title, list) =>
    list.length > 0 && (
      <section className="gr-section" key={title}>
        <h2>{title}</h2>
        <div className="gr-cards">
          {list.map((g) => (
            <GreetCard key={g.id} g={g} onOpen={a.openGreet} />
          ))}
        </div>
      </section>
    );
  const firstRun = !a.greets.length;
  return (
    <div className={"gr-page" + (firstRun ? " is-first" : "")}>
      <p className="gr-eyebrow">
        {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1 className="gr-title">
        {greeting()}
        {name ? `, ${name}` : ""}
      </h1>
      {ready.map((g) => (
        <button key={g.id} className="gr-alert" onClick={() => a.openGreet(g)}>
          <span className="gr-alert-dot" />
          <span>
            <b>{first(g.name)} is ready.</b>
            <small>Tap to find {first(g.name)}.</small>
          </span>
          <ChevronRight size={20} />
        </button>
      ))}
      {firstRun && <FirstRun onCreate={a.create} />}
      {section("Active", active)}
      {section("Today", todays)}
      {section("Upcoming", upcoming)}
      {!firstRun && !open.length && (
        <Empty icon={Handshake} title="Nothing coming up" text="Tap + to set up your next pickup." />
      )}
      {(firstRun || !a.session) && (
        <div className="gr-first-foot">
          {firstRun && (
            <button className="gr-linkrow" onClick={() => a.setModal("join")}>
              <span>Have an Arigreet link?</span>
              <b>
                Open it <ChevronRight size={17} />
              </b>
            </button>
          )}
          {!a.session && (
            <p className="gr-signin">
              Already use Arigreet? <button onClick={() => a.setModal("auth")}>Sign in</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GreetsTab() {
  const a = useApp();
  const [tab, setTab] = useState("Active");
  const [q, setQ] = useState("");
  const today = localDate();
  const lists = {
    Active: a.greets.filter((g) => !ENDED.includes(g.state) && g.date <= today),
    Upcoming: a.greets.filter((g) => !ENDED.includes(g.state) && g.date > today),
    Completed: a.greets.filter((g) => g.state === "COMPLETED"),
    Cancelled: a.greets.filter((g) => ["CANCELLED", "EXPIRED"].includes(g.state)),
  };
  const shown = lists[tab]
    .filter((g) => [g.name, g.flight, g.airport].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) =>
      tab === "Upcoming" ? (x.date + x.time).localeCompare(y.date + y.time) : (y.date + y.time).localeCompare(x.date + x.time),
    );
  return (
    <div className="gr-page">
      <h1 className="gr-title">Greets</h1>
      {a.greets.length > 4 && (
        <label className="gr-search">
          <Search size={18} />
          <input placeholder="Search guest, flight or airport" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Greets" />
        </label>
      )}
      <div className="seg" role="tablist" aria-label="Filter Greets">
        {Object.keys(lists).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t}
            {lists[t].length > 0 && <em>{lists[t].length}</em>}
          </button>
        ))}
      </div>
      <div className="gr-cards">
        {shown.map((g) => (
          <GreetCard key={g.id} g={g} onOpen={a.openGreet} />
        ))}
      </div>
      {!shown.length && (
        <Empty
          icon={q ? Search : Handshake}
          title={q ? "No matches" : `No ${tab.toLowerCase()} Greets`}
          text={q ? "Try another name or flight." : tab === "Active" ? "Greets for today and earlier appear here." : undefined}
        />
      )}
    </div>
  );
}


/* ── Profile (spec §48–49) ───────────────────────────────── */
function EditText({ title, label, value, type = "text", onSave, onClose, hint }) {
  const [v, setV] = useState(value || "");
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="sheet-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(v.trim());
          onClose();
        }}
      >
        <label className="fld">
          <span>{label}</span>
          <input type={type} value={v} onChange={(e) => setV(e.target.value)} />
          {hint && <small>{hint}</small>}
        </label>
        <button className="btn primary">Save</button>
      </form>
    </Sheet>
  );
}

function VehiclesSheet({ onClose }) {
  const a = useApp();
  const list = a.profile?.vehicles || [];
  const [draft, setDraft] = useState(null);
  const file = useRef(null);
  const save = (vehicles) => a.run(() => a.saveProfile({ vehicles }));
  return (
    <Sheet title="Saved vehicles" onClose={onClose}>
      {!draft ? (
        <>
          <div className="veh-list">
            {list.map((v) => (
              <div key={v.id} className="veh">
                {v.photo ? <img src={v.photo} alt="" /> : <span className="veh-icon"><Car size={22} /></span>}
                <span>
                  <b>{[v.colour, v.vehicle].filter(Boolean).join(" ")}</b>
                  {v.plate && <Plate>{v.plate}</Plate>}
                </span>
                <button aria-label={"Remove " + v.vehicle} onClick={() => save(list.filter((x) => x.id !== v.id))}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {!list.length && <p className="muted">Save the vehicles you use, then pick one when you create a Greet.</p>}
          </div>
          <button className="btn primary" onClick={() => setDraft({ id: Date.now().toString(36), vehicle: "", colour: "", plate: "", photo: "" })}>
            <Plus size={19} /> Add vehicle
          </button>
        </>
      ) : (
        <form
          className="sheet-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await save([...list, { ...draft, plate: draft.plate.toUpperCase() }]);
            setDraft(null);
          }}
        >
          <label className="fld"><span>Make and model</span><input required value={draft.vehicle} placeholder="Mercedes-Benz V-Class" onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })} /></label>
          <label className="fld"><span>Colour</span><input value={draft.colour} placeholder="Black" onChange={(e) => setDraft({ ...draft, colour: e.target.value })} /></label>
          <label className="fld"><span>Licence plate</span><input className="caps" value={draft.plate} placeholder="ABC-1234" onChange={(e) => setDraft({ ...draft, plate: e.target.value })} /></label>
          <button type="button" className="btn soft" onClick={() => file.current.click()}>
            <Camera size={18} /> {draft.photo ? "Change photo" : "Add photo (optional)"}
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setDraft({ ...draft, photo: await shrink(f) }); }} />
          <button className="btn primary">Save vehicle</button>
          <button type="button" className="btn ghost" onClick={() => setDraft(null)}>Cancel</button>
        </form>
      )}
    </Sheet>
  );
}

function BoardSheet({ onClose }) {
  const a = useApp();
  const [b, setB] = useState({ theme: "Signature", boardName: "Full name", boardOrientation: "Portrait", ...(a.profile?.board || {}) });
  const seg = (label, key, opts) => (
    <div className="seg-wrap">
      <span>{label}</span>
      <div className="seg">
        {opts.map(([v, t]) => (
          <button key={v} type="button" className={b[key] === v ? "on" : ""} onClick={() => setB({ ...b, [key]: v })}>{t}</button>
        ))}
      </div>
    </div>
  );
  return (
    <Sheet title="Default GreetBoard" onClose={onClose}>
      <GreetBoardPreview form={{ ...b, name: "Helen Johnson" }} small />
      {seg("Name", "boardName", [["Full name", "Full name"], ["First name", "First name"]])}
      {seg("Colour", "theme", Object.entries(BOARD_STYLES).map(([k, v]) => [k, v.label]))}
      {seg("Shape", "boardOrientation", [["Portrait", "Portrait"], ["Landscape", "Landscape"]])}
      <button className="btn primary" onClick={() => a.run(async () => { await a.saveProfile({ board: b }); onClose(); })}>Save</button>
    </Sheet>
  );
}

function ProfileTab() {
  const a = useApp();
  const [sheet, setSheet] = useState(null);
  const photo = useRef(null);
  const p = a.profile || {};
  if (!a.session)
    return (
      <div className="gr-page">
        <h1 className="gr-title">Profile</h1>
        <Empty
          icon={User}
          title="Sign in to Arigreet"
          text="Keep your Greets, vehicles and GreetBoard across devices."
          action={
            <button className="btn primary" onClick={() => a.setModal("auth")}>
              Sign in or create account
            </button>
          }
        />
      </div>
    );
  const notif = p.notifications || {};
  const row = (Icon, label, value, onClick, danger) => (
    <button className={"pf-row " + (danger ? "danger" : "")} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
      {value !== undefined && <em>{value}</em>}
      {!danger && <ChevronRight size={18} />}
    </button>
  );
  return (
    <div className="gr-page">
      <div className="pf-head">
        <button className="pf-photo" onClick={() => photo.current.click()} aria-label="Change photo">
          <Avatar name={p.name} src={p.photo} size={84} />
          <span><Camera size={15} /></span>
        </button>
        <input ref={photo} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) a.run(async () => a.saveProfile({ photo: await shrink(f, 480) })); }} />
        <h1>{p.name}</h1>
        <small>{p.email}</small>
      </div>
      <div className="pf-group">
        {row(User, "Name", p.name, () => setSheet("name"))}
        {row(Building2, "Company", p.company || "Add", () => setSheet("company"))}
        {row(Phone, "Phone", p.phone || "Add", () => setSheet("phone"))}
        {row(Mail, "Email", p.email, () => {})}
      </div>
      <div className="pf-group">
        {row(Maximize2, "Default GreetBoard", BOARD_STYLES[p.board?.theme || "Signature"]?.label, () => setSheet("board"))}
        {row(Car, "Saved vehicles", (p.vehicles || []).length || "None", () => setSheet("vehicles"))}
      </div>
      <div className="pf-group">
        {row(Globe, "Language", p.language || "English", () => setSheet("language"))}
        {row(Bell, "Notifications", notif.enabled ? "On" : "Off", () => setSheet("notifications"))}
        {row(ShieldCheck, "Privacy", undefined, () => setSheet("privacy"))}
        {row(LifeBuoy, "Help", undefined, () => setSheet("help"))}
      </div>
      <div className="pf-group">
        {row(LogOut, "Sign out", undefined, a.signOut, true)}
        {row(Trash2, "Delete account", undefined, () => setSheet("delete"), true)}
      </div>

      {sheet === "name" && <EditText title="Your name" label="Name guests see" value={p.name} onClose={() => setSheet(null)} onSave={(v) => a.saveProfile({ name: v })} />}
      {sheet === "company" && <EditText title="Company" label="Company name" value={p.company} hint="Shown on your guests’ links. Leave empty if you’re meeting family or friends." onClose={() => setSheet(null)} onSave={(v) => a.saveProfile({ company: v })} />}
      {sheet === "phone" && <EditText title="Phone" label="Phone number" type="tel" value={p.phone} hint="Guests can call this number from their link." onClose={() => setSheet(null)} onSave={(v) => a.saveProfile({ phone: v })} />}
      {sheet === "board" && <BoardSheet onClose={() => setSheet(null)} />}
      {sheet === "vehicles" && <VehiclesSheet onClose={() => setSheet(null)} />}
      {sheet === "language" && (
        <Sheet title="Language" onClose={() => setSheet(null)}>
          <div className="pf-group">
            {["English", "Ελληνικά", "Français", "Español", "Deutsch", "Italiano"].map((l) => (
              <button key={l} className="pf-row" onClick={() => a.run(async () => { await a.saveProfile({ language: l }); setSheet(null); })}>
                <span>{l}</span>
                {(p.language || "English") === l && <Check size={18} />}
              </button>
            ))}
          </div>
          <p className="muted">More languages are on the way. The app shows in English for now.</p>
        </Sheet>
      )}
      {sheet === "notifications" && (
        <Sheet title="Notifications" onClose={() => setSheet(null)}>
          <p className="muted">Arigreet tells you when your guest opens the link, lands, collects bags, is ready, is nearby, or flashes your GreetBoard. Nothing else.</p>
          <button className="btn primary" onClick={() => a.run(async () => { await a.enableNotifications(); await a.saveProfile({ notifications: { ...notif, enabled: true } }); })}>
            {notif.enabled ? "Notifications are on" : "Turn on notifications"}
          </button>
          <label className="tgl">
            <span><b>Sound when flashed</b><small>A short chime when your guest flashes your board.</small></span>
            <input type="checkbox" checked={!!notif.sound} onChange={(e) => a.run(() => a.saveProfile({ notifications: { ...notif, sound: e.target.checked } }))} />
          </label>
        </Sheet>
      )}
      {sheet === "privacy" && (
        <Sheet title="Privacy" onClose={() => setSheet(null)}>
          <ul className="pf-points">
            <li>Location is shared only during a Live Greet, and only with the other person.</li>
            <li>Sharing stops when you meet, end sharing, or the Greet ends.</li>
            <li>Guests never need an account. Their link expires after 7 days.</li>
            <li>What your guest adds to help you recognize them is visible only to you, during that Greet.</li>
            <li>Finished Greets are deleted automatically after 30 days.</li>
          </ul>
          <a className="btn soft" href="/privacy">Read the privacy policy</a>
          <a className="btn ghost" href="/terms">Terms</a>
        </Sheet>
      )}
      {sheet === "delete" && <DeleteAccount close={() => setSheet(null)} />}
      {sheet === "help" && (
        <Sheet title="Help" onClose={() => setSheet(null)}>
          <ul className="pf-points">
            <li><b>Guest can’t open the link?</b> Send it again from the Greet, or show the QR code.</li>
            <li><b>Location jumping indoors?</b> Use the meeting point and the GreetBoard. Arigreet never guesses a distance it can’t measure.</li>
            <li><b>Can’t see each other?</b> Show your GreetBoard. Your guest can flash it so it pulses.</li>
          </ul>
        </Sheet>
      )}
    </div>
  );
}

/* One tap tells the passenger where you are: her biggest worry is whether
   anyone is actually there for her. */
function PresenceBar({ g }) {
  const a = useApp();
  const n = first(g.name);
  const code = g.greeterStatus?.code;
  const [late, setLate] = useState(false);
  const send = (v) => a.run(() => a.action("presence", v)).then(() => setLate(false));
  const opts = [
    ["ON_MY_WAY", "On my way"],
    ["LATE", "Running late"],
    ["AT_ARRIVALS", "At Arrivals"],
  ];
  return (
    <section className="dt-presence">
      <b>Let {n} know</b>
      <div className="dt-presence-row" role="group" aria-label={`Tell ${n} where you are`}>
        {opts.map(([v, label]) => {
          const on = v === "LATE" ? code?.startsWith("LATE") : code === v;
          return (
            <button
              key={v}
              className={on ? "on" : ""}
              aria-pressed={on}
              disabled={a.busy}
              onClick={() => (v === "LATE" ? setLate(!late) : send(v))}
            >
              {label}
              {v === "LATE" && code?.startsWith("LATE") && <small>{code.slice(5)} min</small>}
            </button>
          );
        })}
      </div>
      {late && (
        <div className="dt-presence-row late">
          {["10", "20", "30"].map((m) => (
            <button key={m} disabled={a.busy} onClick={() => send("LATE_" + m)}>
              +{m} min
            </button>
          ))}
        </div>
      )}
      <small>{code ? `${n} sees this on their pickup page.` : `${n} sees whatever you tap here.`}</small>
    </section>
  );
}

/* GDPR erasure: one confirmation with the password, then everything is gone. */
function DeleteAccount({ close }) {
  const a = useApp();
  const [password, setPassword] = useState("");
  const googleOnly = !!a.profile?.googleOnly;
  const ready = googleOnly ? password.trim().toUpperCase() === "DELETE" : !!password;
  return (
    <Sheet title="Delete your account?" onClose={close}>
      <p className="sh-lede">
        This deletes your account, your profile and every Greet you created, including links you’ve sent. It can’t be undone.
      </p>
      <form
        className="sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          a.run(async () => {
            await a.api("/account/delete", googleOnly ? { confirm: "DELETE" } : { password });
            close();
            a.signOut();
          });
        }}
      >
        {googleOnly ? (
          <label className="fld">
            <span>Type DELETE to confirm</span>
            <input required autoCapitalize="characters" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        ) : (
          <label className="fld">
            <span>Your password</span>
            <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <button className="btn danger" disabled={a.busy || !ready}>
          Delete everything
        </button>
        <button type="button" className="btn ghost" onClick={close}>
          Keep my account
        </button>
      </form>
    </Sheet>
  );
}

/* ── Greet detail (spec §21, §31, §44) ───────────────────── */
function Detail() {
  const a = useApp();
  const g = a.g;
  if (!g) return null;
  const n = first(g.name);
  const live = LIVE.includes(g.state);
  const ended = ENDED.includes(g.state);
  const fs = g.flightData;
  const delay =
    fs?.estimated && g.time ? Math.round((new Date(fs.estimated).getTime() - Date.parse(`${g.date}T${g.time}`)) / 60000) : 0;
  const stage = {
    CREATED: [`Send the link to ${n}`, `${n} needs the link to find you.`],
    INVITATION_SENT: [`Waiting for ${n}`, `Link sent. ${n} hasn’t opened it yet.`],
    INVITATION_OPENED: [`Waiting for ${n}`, `${n} opened the link. You’ll be told when ${n} is ready.`],
    LANDED: [`${n} has landed`, `You’ll be told when ${n} has their bags.`],
    BAGGAGE_COLLECTION: [`${n} is collecting baggage`, `You’ll be told when ${n} is ready.`],
  }[g.state];
  // Spec §51: passenger landed but has gone quiet.
  const arrival = fs?.actual
    ? new Date(fs.actual).getTime()
    : fs?.estimated
      ? new Date(fs.estimated).getTime()
      : Date.parse(`${g.date}T${g.time || "00:00"}`);
  const sinceLanding = Number.isFinite(arrival) ? Math.round((a.now - arrival) / 60000) : 0;
  const quiet =
    stage &&
    ((["CREATED", "INVITATION_SENT"].includes(g.state) && sinceLanding >= 20) ||
      (g.state === "INVITATION_OPENED" && sinceLanding >= 60) ||
      (g.state === "BAGGAGE_COLLECTION" && sinceLanding >= 75));
  const ago =
    sinceLanding < 60
      ? `${sinceLanding} min ago`
      : sinceLanding < 180
        ? `${Math.floor(sinceLanding / 60)} h ${sinceLanding % 60} min ago`
        : "a while ago";
  if (quiet)
    stage[1] = ["CREATED", "INVITATION_SENT"].includes(g.state)
      ? `${n}’s flight landed ${ago} and the link hasn’t been opened. Send it again or call ${n}.`
      : `${n}’s flight landed ${ago}. Baggage can take a while. You’ll be told the moment they’re ready.`;
  return (
    <div className="gr-page dt">
      <div className="dt-head">
        <Avatar name={g.name} src={g.photo} size={64} />
        <div>
          <h1>{g.name}</h1>
          <Status g={g} />
        </div>
      </div>

      {g.helpAt && a.now - g.helpAt < 3 * 60000 && !ended && (
        <section className="dt-help" role="alert">
          <b>{n} can’t find you.</b>
          <p>Hold up your GreetBoard where {n} can see it.</p>
          <button className="btn lime" onClick={() => a.setModal("board")}>
            <Maximize2 size={18} /> Show GreetBoard
          </button>
          {g.phone && (
            <a className="btn soft" href={"tel:" + g.phone}>
              <Phone size={18} /> Call {n}
            </a>
          )}
        </section>
      )}

      {g.state === "PASSENGER_READY" && !a.sharing && (
        <section className="dt-ready">
          <b>{n} is ready.</b>
          <p>{n} has collected {g.identification?.bags === 0 ? "everything" : "their bags"} and is ready to meet.</p>
          <button className="btn primary" onClick={() => a.setModal("permission")}>
            Find {n}
          </button>
          {g.phone && (
            <a className="btn soft" href={"tel:" + g.phone}>
              <Phone size={18} /> Call {n}
            </a>
          )}
        </section>
      )}

      {live && (g.state !== "PASSENGER_READY" || a.sharing) && <Live />}

      {g.state === "COMPLETED" && (
        <section className="dt-done">
          <span className="dt-check"><Check size={30} strokeWidth={3} /></span>
          <h2>Greet complete.</h2>
          <dl>
            <div><dt>Guest</dt><dd>{g.name}</dd></div>
            <div><dt>Met at</dt><dd>{clock(g.completedAt)}</dd></div>
            {g.readyAt && <div><dt>Ready → Met</dt><dd>{Math.max(1, Math.round((g.completedAt - g.readyAt) / 60000))} min</dd></div>}
            <div><dt>Location sharing</dt><dd>Stopped</dd></div>
          </dl>
          <button className="btn primary" onClick={() => a.setPage("home")}>Done</button>
          <button className="btn soft" onClick={a.create}>Create another Greet</button>
        </section>
      )}
      {["CANCELLED", "EXPIRED"].includes(g.state) && (
        <section className="dt-stage off">
          <b>{g.state === "CANCELLED" ? "Greet cancelled" : "Invitation expired"}</b>
          <p>{n}’s link no longer works. Location sharing is off.</p>
        </section>
      )}
      {stage && (
        <section className="dt-stage">
          <b>{stage[0]}</b>
          <p>{stage[1]}</p>
          {g.state === "CREATED" && (
            <button className="btn primary" onClick={() => a.setModal("share")}>
              <Send size={18} /> Send to {n}
            </button>
          )}
          {quiet && g.state !== "CREATED" && (
            <div className="gs-duo">
              {g.state === "INVITATION_SENT" && (
                <button className="btn soft" onClick={() => a.setModal("share")}>
                  <Send size={17} /> Send again
                </button>
              )}
              {g.phone && (
                <a className="btn soft" href={"tel:" + g.phone}>
                  Call {n}
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {!ended && !["CREATED", "MEETING_CONFIRMATION"].includes(g.state) && <PresenceBar g={g} />}

      <section className="dt-group">
        <div className="dt-row">
          <Plane size={20} />
          <span>
            <small>Flight</small>
            <b>{[g.flight || "No flight", airportName(g.airport) + (airportCode(g.airport) ? " " + airportCode(g.airport) : "")].join(" · ")}</b>
            <p>
              Arrival {g.time} · {dayLabel(g.date)}
              {g.terminal ? ` · ${g.terminal}` : ""}
            </p>
            {fs ? (
              <p className={/cancel|divert/i.test(fs.status || "") ? "bad" : delay > 15 ? "warn" : "ok"}>
                {/cancel/i.test(fs.status || "")
                  ? "Flight cancelled"
                  : /divert/i.test(fs.status || "")
                    ? "Flight diverted"
                    : fs.actual
                      ? `Landed ${new Date(fs.actual).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : delay > 15
                        ? `Delayed · now ${new Date(fs.estimated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : fs.status || "On time"}
              </p>
            ) : g.flight && !ended ? (
              <p className="muted">{g.flightError ? "Flight information unavailable. Your details still work." : "Live flight updates appear here when available."}</p>
            ) : null}
          </span>
        </div>
        <div className="dt-row">
          <MapPin size={20} />
          <span>
            <small>Meeting point</small>
            <b>{[g.area, g.exit].filter(Boolean).join(" · ")}</b>
            {(g.instructions || g.landmark) && <p>{g.instructions || g.landmark}</p>}
          </span>
        </div>
        {g.vehicle && (
          <div className="dt-row">
            <Car size={20} />
            <span>
              <small>Vehicle</small>
              <b>{[g.colour, g.vehicle].filter(Boolean).join(" ")}</b>
              {g.plate && <Plate>{g.plate}</Plate>}
            </span>
          </div>
        )}
        {g.identification && (g.identification.wearing || g.identification.bagDescription) && (
          <div className="dt-row">
            <User size={20} />
            <span>
              <small>{n} will be wearing</small>
              <b>{[g.identification.wearing, g.identification.bagDescription].filter(Boolean).join(" · ")}</b>
              {g.identification.other && <p>{g.identification.other}</p>}
            </span>
          </div>
        )}
      </section>

      <section className="dt-board">
        <div>
          <small>GreetBoard</small>
          <b>
            {n} looks for {g.beacon || "Klein Blue"} <span className="ui-dots">●●●</span>
          </b>
        </div>
        <button onClick={() => a.setModal("board")} aria-label="Show GreetBoard">
          <GreetBoardPreview form={g} small />
        </button>
      </section>

      <section>
        <h2 className="dt-h">Progress</h2>
        <Timeline g={g} />
      </section>

      <section className="pf-group">
        {g.phone && (
          <a className="pf-row" href={"tel:" + g.phone}><Phone size={20} /><span>Call {n}</span><ChevronRight size={18} /></a>
        )}
        <button className="pf-row" onClick={() => a.setModal("board")}><Maximize2 size={20} /><span>Show GreetBoard</span><ChevronRight size={18} /></button>
        {!ended && (
          <button className="pf-row" onClick={() => a.setModal("share")}><Link2 size={20} /><span>{g.state === "CREATED" ? `Send to ${n}` : "Send link again"}</span><ChevronRight size={18} /></button>
        )}
        {!ended && !live && (
          <button className="pf-row" onClick={a.editGreet}><Pencil size={20} /><span>Edit</span><ChevronRight size={18} /></button>
        )}
        {!ended && (
          <button className="pf-row danger" onClick={() => a.setModal("cancel")}><XCircle size={20} /><span>Cancel Greet</span></button>
        )}
      </section>
    </div>
  );
}

/* iOS 27 shell: a quiet navigation bar that turns to glass with a hairline once
   content scrolls under it, an inline title that takes over from the large
   title, and a floating glass tab bar with Create Greet as the prominent tab. */
export default function Greeter() {
  const a = useApp();
  const tab = a.page === "detail" ? "greets" : a.page;
  const [scrolled, setScrolled] = useState(false);
  const [titled, setTitled] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 4);
      setTitled(y > 64);
      if (Math.abs(y - last) > 6) setCompact(y > last && y > 120);
      last = y;
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [a.page]);
  const name = first(a.profile?.name || a.session?.user?.name);
  const title =
    a.page === "detail"
      ? a.g?.name
      : { home: greeting() + (name ? ", " + name : ""), greets: "Greets", profile: "Profile" }[a.page];
  return (
    <div className="gr">
      <header className={"gr-head" + (scrolled ? " is-scrolled" : "")}>
        {a.page === "detail" ? (
          <button className="glass-btn" onClick={() => a.setPage("greets")} aria-label="Back to Greets">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className={"gr-inline-title" + (titled ? " on" : "")} aria-hidden="true">
          {title}
        </span>
        <button className="glass-btn gr-me" onClick={() => a.setPage("profile")} aria-label="Profile">
          {a.session ? (
            <Avatar name={a.profile?.name || a.session.user?.name} src={a.profile?.photo} size={36} />
          ) : (
            <UserRound size={21} />
          )}
        </button>
      </header>
      <main className="gr-main">
        {a.banner}
        {a.page === "home" && <HomeTab />}
        {a.page === "greets" && <GreetsTab />}
        {a.page === "profile" && <ProfileTab />}
        {a.page === "detail" && <Detail />}
      </main>
      <div className={"gr-dock" + (compact ? " is-compact" : "")}>
        <nav className="gr-tabs" aria-label="Main">
          {TABS.map(([id, Icon, label]) => (
            <button key={id} className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => a.setPage(id)}>
              <Icon size={22} strokeWidth={tab === id ? 2.3 : 1.9} />
              <span>{label}</span>
              {id === "home" && a.greets.some((g) => g.state === "PASSENGER_READY") && <i className="gr-badge" />}
            </button>
          ))}
        </nav>
        {a.greets.length > 0 && (
          <button className="gr-fab" onClick={a.create} aria-label="Create Greet">
            <Plus size={26} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}
