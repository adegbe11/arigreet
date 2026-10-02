import { SITE } from "./native.js";
import GoogleButton from "./GoogleButton.jsx";
import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronDown,
  Camera,
  Check,
  Copy,
  QrCode,
  Mail,
  MessageCircle,
  MessageSquare,
  Share2,
  Minus,
  Plus,
  Plane,
  MapPin,
  User,
  Car,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import QRCode from "qrcode";
import { BeaconStars } from "./HomeView.jsx";
import "./create.css";
import AirportPicker from "./AirportPicker.jsx";
import { TERMINALS } from "./terminals.js";
import { dayLabel } from "./ui.jsx";

/* Spec §9–19: Who → Arrival → Meeting point → Who to look for → Vehicle →
   Anything else → GreetBoard → Review → (Save your Greet) → Created → Share. */

const STEPS = [
  "who",
  "arrival",
  "meet",
  "greeter",
  "vehicle",
  "extra",
  "board",
  "review",
];
/* Three essentials, then Create. Everything else is optional and reached
   from the review screen ("Add more"), so meeting your mum takes 30 seconds. */
const MAIN = ["who", "arrival", "meet", "review"];
const OPTIONAL = {
  greeter: "Your name and phone",
  vehicle: "Vehicle",
  extra: "Passengers, bags and notes",
  board: "GreetBoard style",
};
const DRAFT = "arigreet-draft-v2";
export const BOARD_STYLES = {
  Signature: { label: "Klein Blue", beacon: "Klein Blue" },
  Dark: { label: "Dark", beacon: "Black" },
  Light: { label: "Light", beacon: "White" },
};
const COLOURS = [
  ["Black", "#111318"],
  ["White", "#ffffff"],
  ["Silver", "#c7ccd4"],
  ["Grey", "#6b7280"],
  ["Blue", "#1d3a8a"],
  ["Red", "#9b1c1c"],
];
const first = (name) => (name || "").trim().split(/\s+/)[0] || "your guest";

/* Photos are resized on the phone and stored with the Greet. */
function shrink(file, max = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () =>
      reject(Error("That photo couldn't be opened. Try another."));
    img.src = URL.createObjectURL(file);
  });
}

/* Known terminals become one-tap choices; anything else can be typed. */
function TerminalField({ code, value, onChange }) {
  const list = TERMINALS[code];
  const [other, setOther] = useState(false);
  const typing = !list || other || (value && !list.includes(value));
  if (list?.length === 1 && !typing)
    return (
      <p className="cf-terminal-one">
        {list[0]} · this airport has one arrivals area.
      </p>
    );
  return (
    <div className="cf-field">
      <span id="term-label">
        Terminal{!list && <em> · Optional</em>}
      </span>
      {list && (
        <div className="cf-chips" role="radiogroup" aria-labelledby="term-label">
          {list.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={value === t && !other}
              className={value === t && !other ? "on" : ""}
              onClick={() => {
                setOther(false);
                onChange(t);
              }}
            >
              {t}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={typing} className={typing ? "on" : ""} onClick={() => (setOther(true), onChange(""))}>
            Other
          </button>
        </div>
      )}
      {typing && (
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={list ? "Type the terminal" : "e.g. Terminal 1"}
          aria-label="Terminal"
          autoFocus={!!list}
        />
      )}
    </div>
  );
}

function Field({ label, hint, textarea, optional, ...props }) {
  const Tag = textarea ? "textarea" : "input";
  if (hint === "Optional") {
    optional = true;
    hint = undefined;
  }
  return (
    <label className="cf-field">
      <span>
        {label}
        {optional && <em> · Optional</em>}
      </span>
      <Tag
        {...props}
        value={props.value ?? ""}
        rows={textarea ? 3 : undefined}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function PhotoField({ label, value, onChange, round, onError, capture }) {
  const input = useRef(null);
  return (
    <div className={"cf-photo " + (round ? "round" : "wide")}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={label}
      >
        {value ? <img src={value} alt="" /> : <Camera size={round ? 26 : 22} />}
      </button>
      <div>
        <b>{label}</b>
        <small>{value ? "Tap to change" : "Optional"}</small>
        {value && (
          <button
            type="button"
            className="cf-text"
            onClick={() => onChange("")}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={capture}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onChange(await shrink(f));
          } catch (err) {
            onError(err.message);
          }
        }}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="cf-toggle">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Stepper({ label, value, onChange, min = 0, max = 20 }) {
  const n = Number(value) || 0;
  return (
    <div className="cf-stepper">
      <b>{label}</b>
      <div>
        <button
          type="button"
          aria-label={"Fewer " + label}
          disabled={n <= min}
          onClick={() => onChange(n - 1)}
        >
          <Minus size={18} />
        </button>
        <output>{n}</output>
        <button
          type="button"
          aria-label={"More " + label}
          disabled={n >= max}
          onClick={() => onChange(n + 1)}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="cf-seg-wrap">
      <span>{label}</span>
      <div className="cf-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            type="button"
            key={v}
            role="radio"
            aria-checked={value === v}
            className={value === v ? "on" : ""}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GreetBoardPreview({ form, small }) {
  const name = (
    form.boardName === "First name"
      ? first(form.name)
      : form.name || "Guest name"
  )
    .toUpperCase()
    .split(/\s+/);
  const style =
    { Signature: "klein", Dark: "dark", Light: "light" }[form.theme] || "klein";
  return (
    <div
      className={`cf-board ${style} ${form.boardOrientation === "Landscape" ? "land" : "port"} ${small ? "small" : ""}`}
    >
      {form.boardShowLogo && form.companyLogo && (
        <img className="cf-board-logo" src={form.companyLogo} alt="" />
      )}
      <BeaconStars />
      <div className="cf-board-name" style={{ "--len": Math.max(4, ...name.map((w) => w.length)) }}>
        {name.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      {form.boardShowFlight && form.flight && (
        <p>{form.flight.toUpperCase()}</p>
      )}
    </div>
  );
}

function Summary({ form, onEdit }) {
  const rows = [
    [User, form.name, [form.phone, form.email].filter(Boolean).join(" · "), "who"],
    [
      Plane,
      [form.flight, form.airport].filter(Boolean).join(" · "),
      [
        form.date &&
          new Date(form.date + "T12:00").toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
          }),
        form.time,
        form.terminal,
      ]
        .filter(Boolean)
        .join(" · "),
      "arrival",
    ],
    [
      MapPin,
      [form.area, form.exit].filter(Boolean).join(" · "),
      form.landmark || form.instructions,
      "meet",
    ],
    form.greeter && [User, form.greeter, form.company, "greeter"],
    form.vehicle && [
      Car,
      [form.colour, form.vehicle].filter(Boolean).join(" "),
      form.plate,
      "vehicle",
    ],
  ].filter(Boolean);
  return (
    <div className="cf-summary">
      {rows.map(([Icon, a, b, to], i) => (
        <button type="button" key={i} onClick={() => onEdit(to)} aria-label={`Edit ${a}`}>
          <Icon size={18} />
          <span>
            <b>{a}</b>
            {b && <small>{b}</small>}
          </span>
          <ChevronRight size={18} className="cf-sum-go" />
        </button>
      ))}
    </div>
  );
}

export default function CreateFlow({
  initial,
  editing,
  session,
  onClose,
  onSubmit,
  onAuth,
  onShared,
  onViewGreet,
  onShowBoard,
}) {
  const [form, setForm] = useState(() => {
    if (editing) return initial;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      if (d?.form?.name) return { ...initial, ...d.form };
    } catch {}
    return initial;
  });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [phase, setPhase] = useState("steps"); // steps | save | created | share
  const [more, setMore] = useState(!!(form.phone || form.email || form.photo));
  const [authMode, setAuthMode] = useState(null); // null | register | login
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [greet, setGreet] = useState(null);
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const scroller = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const guest = first(form.name);

  useEffect(() => {
    if (editing || phase !== "steps") return;
    try {
      localStorage.setItem(DRAFT, JSON.stringify({ form }));
    } catch {}
  }, [form, editing, phase]);
  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
    setError("");
  }, [step, phase]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const meta = document.querySelector('meta[name="theme-color"]');
    const old = meta?.content;
    meta?.setAttribute("content", "#ffffff");
    return () => {
      document.body.style.overflow = prev;
      if (meta && old) meta.setAttribute("content", old);
    };
  }, []);

  const valid =
    {
      who: !!form.name?.trim(),
      arrival: !!(form.date && form.airport?.trim() && form.time),
      meet: !!(form.area?.trim() || form.exit?.trim()),
      greeter: !!form.greeter?.trim(),
    }[STEPS[step]] ?? true;

  const go = (n) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const REVIEW = STEPS.indexOf("review");
  const isOptional = (i) => !MAIN.includes(STEPS[i]);
  const next = () => {
    const name = STEPS[step];
    if (name === "meet" || isOptional(step)) return go(REVIEW);
    go(step + 1);
  };
  const back = () => {
    if (phase === "save") return setPhase("steps");
    if (step === 0) return onClose();
    if (isOptional(step)) return go(REVIEW);
    if (STEPS[step] === "review") return go(STEPS.indexOf("meet"));
    go(step - 1);
  };
  const mainIndex = isOptional(step) ? MAIN.length - 1 : MAIN.indexOf(STEPS[step]);
  const [picking, setPicking] = useState(false);
  const pickAirport = (a) => {
    const list = TERMINALS[a.iata];
    setForm((f) => ({
      ...f,
      airport: `${a.city} (${a.iata})`,
      airportCode: a.iata,
      airportTimezone: a.tz,
      airportFull: a.name,
      airportLat: a.lat,
      airportLng: a.lon,
      terminal: list?.length === 1 ? list[0] : list?.includes(f.terminal) ? f.terminal : "",
    }));
    setPicking(false);
  };
  const finalForm = () => ({
    ...form,
    beacon: BOARD_STYLES[form.theme]?.beacon || "Klein Blue",
    allowCall: !!form.contact,
    flight: (form.flight || "").toUpperCase().trim(),
    plate: (form.plate || "").toUpperCase().trim(),
  });
  const submit = async (token) => {
    setBusy(true);
    setError("");
    try {
      const g = await onSubmit(finalForm(), token);
      try {
        localStorage.removeItem(DRAFT);
      } catch {}
      if (editing) return onViewGreet(g);
      setGreet(g);
      setMessage(
        `Hi ${first(g.name)}, it's ${first(g.greeter) || "me"}. I'm meeting you at ${g.airport ? g.airport.replace(/\s*\(.*\)/, "") + " Airport" : "the airport"}${[g.area, g.exit].filter(Boolean).length ? ", " + [g.area, g.exit].filter(Boolean).join(", ") : ""}. Open this link now so it's saved on your phone, then open it again when you land. No app needed.`,
      );
      setPhase("created");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const create = () => (session || editing ? submit() : setPhase("save"));
  const doAuth = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await onAuth(authMode, auth);
      setBusy(false);
      await submit(data.token);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const link = greet ? SITE + "/g/" + greet.token : "";
  const shareText = message + "\n" + link;
  const shared = () => onShared?.(greet);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      shared();
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it.");
    }
  };

  const stepBody = () => {
    switch (STEPS[step]) {
      case "who":
        return (
          <>
            <h1>Who are you meeting?</h1>
            <Field
              label="Guest name"
              placeholder="Helen Johnson"
              value={form.name}
              autoFocus
              autoComplete="off"
              onChange={(e) => set("name", e.target.value)}
            />
            {more ? (
              <>
                <Field
                  label="Guest phone number"
                  hint="Optional"
                  type="tel"
                  placeholder="+30 690 000 0000"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
                <Field
                  label="Guest email"
                  hint="Optional"
                  type="email"
                  placeholder="helen@example.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
                <PhotoField
                  label="Guest photo"
                  round
                  value={form.photo}
                  onChange={(v) => set("photo", v)}
                  onError={setError}
                />
              </>
            ) : (
              <button
                type="button"
                className="cf-more"
                onClick={() => setMore(true)}
              >
                Add phone, email or photo <ChevronDown size={18} />
              </button>
            )}
          </>
        );
      case "arrival":
        return (
          <>
            <h1>When are they arriving?</h1>
            <Field
              label="Flight number"
              optional
              className="cf-caps"
              placeholder="A3 123"
              value={form.flight}
              autoCapitalize="characters"
              onChange={(e) => set("flight", e.target.value)}
            />
            <div className="cf-row">
              <Field
                label="Arrival date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              <Field
                label="Arrival time"
                type="time"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </div>
            <div className="cf-field">
              <span id="ap-label">Airport</span>
              <button type="button" className="cf-picker" aria-labelledby="ap-label" onClick={() => setPicking(true)}>
                {form.airportCode ? (
                  <>
                    <span className="ap-code">{form.airportCode}</span>
                    <span className="ap-text">
                      <b>{form.airport.replace(/\s*\(.*\)/, "")}</b>
                      {form.airportFull && <small>{form.airportFull}</small>}
                    </span>
                  </>
                ) : (
                  <span className="cf-picker-empty">Search city, airport or code</span>
                )}
                <ChevronRight size={20} />
              </button>
            </div>
            <TerminalField code={form.airportCode} value={form.terminal} onChange={(v) => set("terminal", v)} />
          </>
        );
      case "meet":
        return (
          <>
            <h1>Where will you meet?</h1>
            <p className="cf-context">
              {[form.airport, form.terminal].filter(Boolean).join(" · ")}
              <button type="button" className="cf-text" onClick={() => go(1)}>
                Change
              </button>
            </p>
            <div className="cf-row">
              <Field
                label="Arrivals area"
                placeholder="Arrivals Hall"
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
              />
              <Field
                label="Exit or door"
                placeholder="Exit 3"
                value={form.exit}
                onChange={(e) => set("exit", e.target.value)}
              />
            </div>
            <Field
              label="Landmark"
              hint="Optional"
              placeholder="Information desk"
              value={form.landmark}
              onChange={(e) => set("landmark", e.target.value)}
            />
            <Field
              label="Meeting instructions"
              hint="Optional"
              textarea
              placeholder="I'll be beside the information desk."
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </>
        );
      case "greeter":
        return (
          <>
            <h1>Who should {guest} look for?</h1>
            <p className="cf-lede">This appears on {guest}’s link.</p>
            <div className="cf-preview-card">
              {form.greeterPhoto ? (
                <img src={form.greeterPhoto} alt="" />
              ) : (
                <span className="cf-avatar">
                  {(form.greeter || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>
                <small>{guest} will see</small>
                <b>{form.greeter || "Your name"} is meeting you</b>
                {form.company && <small>{form.company}</small>}
              </span>
            </div>
            <Field
              label="Your name"
              placeholder="Michael Collins"
              value={form.greeter}
              onChange={(e) => set("greeter", e.target.value)}
            />
            <PhotoField
              label="Your photo"
              round
              capture="user"
              value={form.greeterPhoto}
              onChange={(v) => set("greeterPhoto", v)}
              onError={setError}
            />
            <Field
              label="Company name"
              hint="Optional"
              placeholder="Elite Transfers"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
            />
            {form.company && (
              <PhotoField
                label="Company logo"
                value={form.companyLogo}
                onChange={(v) => set("companyLogo", v)}
                onError={setError}
              />
            )}
            <Field
              label="Phone number"
              optional
              hint={`${guest} can call you from the link.`}
              type="tel"
              placeholder="+30 690 000 0000"
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
            />
          </>
        );
      case "vehicle":
        return (
          <>
            <h1>Your vehicle</h1>
            <p className="cf-lede">Helps {guest} spot the car outside.</p>
            <Field
              label="Make and model"
              placeholder="Mercedes-Benz V-Class"
              value={form.vehicle}
              onChange={(e) => set("vehicle", e.target.value)}
            />
            <div className="cf-seg-wrap">
              <span>Colour</span>
              <div className="cf-colours">
                {COLOURS.map(([name, hex]) => (
                  <button
                    type="button"
                    key={name}
                    aria-label={name}
                    aria-pressed={form.colour === name}
                    className={form.colour === name ? "on" : ""}
                    style={{ "--c": hex }}
                    onClick={() => set("colour", name)}
                  >
                    <i />
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Licence plate"
              className="cf-caps"
              placeholder="ABC-1234"
              autoCapitalize="characters"
              value={form.plate}
              onChange={(e) => set("plate", e.target.value)}
            />
            {form.plate && (
              <span className="plate cf-plate">
                <i />
                {form.plate.toUpperCase()}
              </span>
            )}
            <PhotoField
              label="Vehicle photo"
              value={form.vehiclePhoto}
              onChange={(v) => set("vehiclePhoto", v)}
              onError={setError}
            />
            <Toggle
              label="Save this vehicle"
              hint="Use it again for future Greets."
              checked={form.saveVehicle}
              onChange={(v) => set("saveVehicle", v)}
            />
          </>
        );
      case "extra":
        return (
          <>
            <h1>Anything else?</h1>
            <p className="cf-lede">All optional.</p>
            <div className="cf-group">
              <Stepper
                label="Passengers"
                min={1}
                value={form.passengers}
                onChange={(v) => set("passengers", v)}
              />
              <Stepper
                label="Bags"
                value={form.bags}
                onChange={(v) => set("bags", v)}
              />
              <Toggle
                label="Child seat"
                checked={form.childSeat}
                onChange={(v) => set("childSeat", v)}
              />
              <Toggle
                label="Accessibility assistance"
                checked={form.assistance}
                onChange={(v) => set("assistance", v)}
              />
            </div>
            <Field
              label="Additional note"
              textarea
              placeholder="Anything else about the pickup"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </>
        );
      case "board":
        return (
          <>
            <h1>Your GreetBoard</h1>
            <p className="cf-lede">Your digital airport sign.</p>
            <GreetBoardPreview form={form} />
            <p className="cf-identifier">
              {guest} will look for{" "}
              <b>
                {BOARD_STYLES[form.theme]?.beacon || "Klein Blue"}{" "}
                <span>●●●</span>
              </b>
            </p>
            <Segmented
              label="Name"
              value={form.boardName || "Full name"}
              onChange={(v) => set("boardName", v)}
              options={[
                ["Full name", "Full name"],
                ["First name", "First name"],
              ]}
            />
            <Segmented
              label="Colour"
              value={form.theme || "Signature"}
              onChange={(v) => set("theme", v)}
              options={Object.entries(BOARD_STYLES).map(([k, v]) => [
                k,
                v.label,
              ])}
            />
            <div className="cf-group">
              {form.flight && (
                <Toggle
                  label="Show flight number"
                  checked={form.boardShowFlight}
                  onChange={(v) => set("boardShowFlight", v)}
                />
              )}
              {form.companyLogo && (
                <Toggle
                  label="Show company logo"
                  checked={form.boardShowLogo}
                  onChange={(v) => set("boardShowLogo", v)}
                />
              )}
            </div>
          </>
        );
      case "review":
        return (
          <>
            <h1>
              {editing ? "Save your changes?" : `Ready to meet ${guest}?`}
            </h1>
            <Summary form={finalForm()} onEdit={(to) => go(STEPS.indexOf(to))} />
            <div className="cf-more-group">
              <h2>Add more · optional</h2>
              {Object.entries(OPTIONAL).map(([key, label]) => {
                const value = {
                  greeter: [form.greeter, form.contact].filter(Boolean).join(" · "),
                  vehicle: [form.colour, form.vehicle, form.plate].filter(Boolean).join(" · "),
                  extra: [form.passengers > 1 && `${form.passengers} people`, form.bags && `${form.bags} ${form.bags === 1 ? "bag" : "bags"}`, form.notes].filter(Boolean).join(" · "),
                  board: BOARD_STYLES[form.theme]?.label,
                }[key];
                return (
                  <button key={key} type="button" className="cf-more-row" onClick={() => go(STEPS.indexOf(key))}>
                    <span>
                      <b>{label}</b>
                      {value && <small>{value}</small>}
                    </span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          </>
        );
    }
  };

  const footer = () => {
    if (phase === "steps") {
      const name = STEPS[step];
      const skippable = ["vehicle", "extra"].includes(name);
      if (name === "review")
        return (
          <>
            <button className="cf-primary" disabled={busy} onClick={create}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create Greet"}
            </button>
          </>
        );
      return (
        <>
          <button
            className="cf-primary"
            disabled={!valid}
            onClick={next}
          >
            {isOptional(step) ? "Done" : "Continue"}
          </button>
          {skippable && (
            <button
              className="cf-secondary"
              onClick={() => {
                if (name === "vehicle")
                  setForm((f) => ({
                    ...f,
                    vehicle: "",
                    colour: "",
                    plate: "",
                    vehiclePhoto: "",
                    saveVehicle: false,
                  }));
                go(REVIEW);
              }}
            >
              {name === "vehicle" ? "No vehicle" : "Skip"}
            </button>
          )}
        </>
      );
    }
    return null;
  };

  return (
    <section
      className="cf"
      aria-label={editing ? "Edit Greet" : "Create a Greet"}
    >
      {["steps", "save"].includes(phase) && (
        <header className="cf-head">
          <button
            className="cf-icon"
            onClick={back}
            aria-label={step === 0 && phase === "steps" ? "Close" : "Back"}
          >
            {step === 0 && phase === "steps" ? (
              <X size={22} />
            ) : (
              <ChevronLeft size={24} />
            )}
          </button>
          <div
            className="cf-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={MAIN.length}
            aria-valuenow={mainIndex + 1}
            aria-label={`Step ${mainIndex + 1} of ${MAIN.length}`}
          >
            {MAIN.map((s, i) => (
              <i key={s} className={i <= mainIndex ? "on" : ""} />
            ))}
          </div>
          <span className="cf-count">
            {phase === "save" ? "" : isOptional(step) ? "Optional" : `${mainIndex + 1} of ${MAIN.length}`}
          </span>
        </header>
      )}
      <div className="cf-scroll" ref={scroller}>
        {phase === "steps" && (
          <div className={"cf-page " + (dir > 0 ? "fwd" : "bwd")} key={step}>
            {stepBody()}
          </div>
        )}

        {phase === "save" && (
          <div className="cf-page fwd">
            <h1>Save your Greet</h1>
            <p className="cf-lede">
              Create an account to manage this Greet and future pickups.
            </p>
            {!authMode ? (
              <div className="cf-auth">
                <GoogleButton
                  disabled={busy}
                  onError={setError}
                  onToken={async (idToken) => {
                    setBusy(true);
                    setError("");
                    try {
                      const data = await onAuth("google", { idToken });
                      setBusy(false);
                      await submit(data.token);
                    } catch (err) {
                      setError(err.message);
                      setBusy(false);
                    }
                  }}
                />
                <button
                  className="cf-primary"
                  onClick={() => {
                    setAuth((a) => ({
                      ...a,
                      name: a.name || form.greeter || "",
                    }));
                    setAuthMode("register");
                  }}
                >
                  <Mail size={19} /> Continue with Email
                </button>
                <button
                  className="cf-text"
                  onClick={() => setAuthMode("login")}
                >
                  Already have an account? Sign in
                </button>
                <p className="cf-fine">
                  {guest} won’t need an account or the app. By continuing you agree to the{" "}
                  <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>.
                </p>
              </div>
            ) : (
              <form className="cf-auth" onSubmit={doAuth}>
                {authMode === "register" && (
                  <Field
                    label="Your name"
                    required
                    autoComplete="name"
                    value={auth.name}
                    onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                  />
                )}
                <Field
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  value={auth.email}
                  onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                />
                <Field
                  label="Password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete={
                    authMode === "register"
                      ? "new-password"
                      : "current-password"
                  }
                  hint={
                    authMode === "register"
                      ? "At least 10 characters."
                      : undefined
                  }
                  value={auth.password}
                  onChange={(e) =>
                    setAuth({ ...auth, password: e.target.value })
                  }
                />
                <button className="cf-primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : authMode === "register"
                      ? "Create account and save"
                      : "Sign in and save"}
                </button>
                <button
                  type="button"
                  className="cf-text"
                  onClick={() =>
                    setAuthMode(authMode === "register" ? "login" : "register")
                  }
                >
                  {authMode === "register"
                    ? "Already have an account? Sign in"
                    : "New to Arigreet? Create an account"}
                </button>
              </form>
            )}
          </div>
        )}

        {phase === "created" && greet && (
          <div className="cf-page cf-done fwd">
            <span className="cf-check">
              <Check size={40} strokeWidth={3} />
            </span>
            <h1>Greet created</h1>
            <div className="cf-done-meta">
              <b>{greet.name}</b>
              <span>
                {[greet.flight, (greet.airport || "").replace(/\s*\(.*\)/, "")]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span>
                {[
                  dayLabel(greet.date),
                  greet.time,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="cf-actions">
              <button className="cf-primary" onClick={() => setPhase("share")}>
                Send to {first(greet.name)} <ArrowRight size={19} />
              </button>
              <div className="cf-pair">
                <button
                  className="cf-secondary"
                  onClick={() => onViewGreet(greet)}
                >
                  View Greet
                </button>
                <button
                  className="cf-secondary"
                  onClick={() => onShowBoard(greet)}
                >
                  Show GreetBoard
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "share" && greet && (
          <div className="cf-page fwd">
            <header className="cf-head flat">
              <button
                className="cf-icon"
                onClick={() => setPhase("created")}
                aria-label="Back"
              >
                <ChevronLeft size={24} />
              </button>
            </header>
            <h1>Send to {first(greet.name)}</h1>
            <p className="cf-lede">
              {first(greet.name)} opens it without an app or account.
            </p>
            <label className="cf-field">
              <span>Message</span>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <div className="cf-link">
              <span>{link.replace(/^https?:\/\//, "")}</span>
              <button onClick={() => copy(link)} aria-label="Copy link">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <div className="cf-share">
              <a
                href={"https://wa.me/?text=" + encodeURIComponent(shareText)}
                target="_blank"
                rel="noreferrer"
                onClick={shared}
              >
                <MessageCircle size={22} /> WhatsApp
              </a>
              <a
                href={
                  "sms:" +
                  (greet.phone || "") +
                  "?&body=" +
                  encodeURIComponent(shareText)
                }
                onClick={shared}
              >
                <MessageSquare size={22} /> Messages
              </a>
              <a
                href={
                  "mailto:" +
                  (greet.email || "") +
                  "?subject=" +
                  encodeURIComponent("Your pickup at the airport") +
                  "&body=" +
                  encodeURIComponent(shareText)
                }
                onClick={shared}
              >
                <Mail size={22} /> Email
              </a>
              <button onClick={() => copy(shareText)}>
                {copied ? <Check size={22} /> : <Copy size={22} />}{" "}
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                onClick={async () => {
                  setQr(
                    qr
                      ? ""
                      : await QRCode.toDataURL(link, {
                          width: 480,
                          margin: 1,
                          color: { dark: "#0b0d12" },
                        }),
                  );
                  shared();
                }}
              >
                <QrCode size={22} /> QR code
              </button>
              {navigator.share && (
                <button
                  onClick={() =>
                    navigator
                      .share({
                        title: "Your Arigreet pickup",
                        text: message,
                        url: link,
                      })
                      .then(shared)
                      .catch(() => {})
                  }
                >
                  <Share2 size={22} /> More
                </button>
              )}
            </div>
            {qr && (
              <figure className="cf-qr">
                <img
                  src={qr}
                  alt={"QR code for " + first(greet.name) + "'s pickup link"}
                />
                <figcaption>
                  {first(greet.name)} scans this to open the pickup.
                </figcaption>
              </figure>
            )}
            <button
              className="cf-primary cf-bottom"
              onClick={() => onViewGreet(greet)}
            >
              Done
            </button>
          </div>
        )}
        {error && (
          <p className="cf-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {footer() && <footer className="cf-foot">{footer()}</footer>}
      {picking && <AirportPicker onPick={pickAirport} onClose={() => setPicking(false)} />}
    </section>
  );
}
