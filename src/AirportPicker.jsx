import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronLeft, Plane } from "lucide-react";
import { TERMINALS, POPULAR } from "./terminals.js";

/* Every airport with an IATA code (≈7,900), loaded the first time the picker
   opens and kept for the session. */
let cache = null;
export function loadAirports() {
  if (!cache)
    cache = fetch("/data/airports.json")
      .then((r) => r.json())
      .then((d) => d.airports.map(([iata, name, city, country, tz, lat, lon]) => ({ iata, name, city, country, tz, lat, lon })))
      .catch((e) => {
        cache = null;
        throw e;
      });
  return cache;
}

const RECENT = "arigreet-recent-airports";
const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
let regionNames;
export const countryName = (code) => {
  try {
    regionNames ||= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
};

function score(a, q, words) {
  const code = a.iata.toLowerCase();
  const city = fold(a.city);
  const name = fold(a.name);
  let s = 0;
  if (code === q) s = 100;
  else if (q.length <= 3 && code.startsWith(q)) s = 70;
  else if (city === q) s = 90;
  else if (city.startsWith(q)) s = 65;
  else if (words.every((w) => name.includes(w) || city.includes(w))) s = name.split(/\W+/).some((w) => w.startsWith(words[0])) ? 50 : 30;
  else if (fold(countryName(a.country)).startsWith(q)) s = 12;
  if (!s) return 0;
  if (TERMINALS[a.iata]) s += 14;
  if (POPULAR.includes(a.iata)) s += 6;
  if (/international/i.test(a.name)) s += 4;
  return s;
}

function Row({ a, onPick }) {
  return (
    <li>
      <button className="ap-row" onClick={() => onPick(a)}>
        <span className="ap-code">{a.iata}</span>
        <span className="ap-text">
          <b>{a.city}</b>
          <small>{a.name}</small>
        </span>
        <span className="ap-country">{countryName(a.country)}</span>
      </button>
    </li>
  );
}

export default function AirportPicker({ onPick, onClose }) {
  const [all, setAll] = useState(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef(null);
  useEffect(() => {
    loadAirports().then(setAll, () => setFailed(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      removeEventListener("keydown", esc);
    };
  }, []);
  const byCode = useMemo(() => new Map((all || []).map((a) => [a.iata, a])), [all]);
  const recent = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT) || "[]").map((c) => byCode.get(c)).filter(Boolean);
    } catch {
      return [];
    }
  }, [byCode]);
  const results = useMemo(() => {
    const t = fold(q.trim());
    if (!all || !t) return null;
    const words = t.split(/\s+/);
    return all
      .map((a) => [a, score(a, t, words)])
      .filter(([, s]) => s)
      .sort((x, y) => y[1] - x[1] || x[0].city.localeCompare(y[0].city))
      .slice(0, 60)
      .map(([a]) => a);
  }, [all, q]);
  const pick = (a) => {
    try {
      const list = [a.iata, ...JSON.parse(localStorage.getItem(RECENT) || "[]").filter((c) => c !== a.iata)].slice(0, 5);
      localStorage.setItem(RECENT, JSON.stringify(list));
    } catch {}
    onPick(a);
  };
  const popular = POPULAR.map((c) => byCode.get(c)).filter(Boolean);

  return (
    <div className="ap" role="dialog" aria-modal="true" aria-label="Choose airport">
      <header className="ap-head">
        <button className="glass-btn" onClick={onClose} aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h2>Airport</h2>
        <span />
      </header>
      <label className="ap-search">
        <Search size={18} />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="City, airport or code"
          aria-label="Search airports"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="search"
        />
        {q && (
          <button onClick={() => (setQ(""), input.current?.focus())} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </label>
      <div className="ap-list">
        {failed && <p className="ap-note">Couldn’t load the airport list. Check your connection and try again.</p>}
        {!all && !failed && <p className="ap-note">Loading airports…</p>}
        {all && results && (
          <>
            {results.length ? (
              <ul>
                {results.map((a) => (
                  <Row key={a.iata} a={a} onPick={pick} />
                ))}
              </ul>
            ) : (
              <p className="ap-note">
                <Plane size={20} />
                No airport matches “{q}”. Try the city or the 3-letter code.
              </p>
            )}
          </>
        )}
        {all && !results && (
          <>
            {recent.length > 0 && (
              <>
                <h3>Recent</h3>
                <ul>
                  {recent.map((a) => (
                    <Row key={a.iata} a={a} onPick={pick} />
                  ))}
                </ul>
              </>
            )}
            <h3>Popular</h3>
            <ul>
              {popular.map((a) => (
                <Row key={a.iata} a={a} onPick={pick} />
              ))}
            </ul>
            <p className="ap-note small">{all.length.toLocaleString()} airports. Search by city, airport name or code.</p>
          </>
        )}
      </div>
    </div>
  );
}
