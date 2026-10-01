import React from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Plane,
  Clock,
  MapPin,
  ChevronRight,
  Search,
  ShieldCheck,
  Star,
  Maximize2,
  Radio,
  Check,
  Users,
  ScanLine,
} from "lucide-react";

export function BrandMark({ size = 30 }) {
  return (
    <svg
      className="brandmark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9.6" fill="#002FA7" />
      <rect
        x=".5"
        y=".5"
        width="31"
        height="31"
        rx="9.1"
        fill="none"
        stroke="#fff"
        strokeOpacity=".16"
      />
      <path
        d="M16 7.2l2.45 5.05 5.55.78-4.03 3.9.97 5.52L16 19.8l-4.94 2.65.97-5.52-4.03-3.9 5.55-.78z"
        fill="#CCFF00"
        stroke="#CCFF00"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function BeaconStars({ className = "" }) {
  // Recognition identifier: three lime dots (●●●)
  return (
    <div className={"beacon-stars " + className} aria-label="Three dots">
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 10 10" aria-hidden="true">
          <circle cx="5" cy="5" r="5" />
        </svg>
      ))}
    </div>
  );
}

export default function HomeView({
  session,
  greets,
  page,
  filter,
  setFilter,
  query,
  setQuery,
  onCreate,
  onOpen,
  onAllGreets,
  onPreview,
  arrivalTime,
}) {
  const date = new Date();
  const localDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const ended = ["COMPLETED", "CANCELLED", "EXPIRED"];
  const active = greets.filter((g) => !ended.includes(g.state));
  const filtered = greets.filter(
    (g) =>
      g.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "Recent"
        ? ended.includes(g.state)
        : filter === "Today"
          ? g.date === localDate
          : filter === "Upcoming"
            ? g.date > localDate
            : !ended.includes(g.state)),
  );
  const statuses = {
    CREATED: "Ready to share",
    INVITATION_SENT: "Invitation sent",
    INVITATION_OPENED: "Invitation opened",
    BAGGAGE_COLLECTION: "Collecting bags",
    PASSENGER_READY: "Ready to meet",
    LIVE_GREET: "Live Greet",
    NEARBY: "Nearby",
    VERY_CLOSE: "At the meeting point",
    MEETING_CONFIRMATION: "Confirm your meeting",
    COMPLETED: "Greet complete",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    LANDED: "Landed",
    FLIGHT_IN_PROGRESS: "In flight",
  };
  const greeting =
    date.getHours() < 12
      ? "Good morning"
      : date.getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const next = active[0];
  return (
    <div className="home-view">
      <div className="page-heading home-heading">
        <div>
          <div className="eyebrow">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(date)}
          </div>
          <h1>
            {page === "home" ? (
              <>
                {greeting}
                {session && (
                  <>
                    ,<br className="mobile-break" />{" "}
                    {session.user.name.split(" ")[0]}
                  </>
                )}
                <span className="lime-stop">.</span>
              </>
            ) : (
              "Your Greets."
            )}
          </h1>
          <p>
            {active.length
              ? `${active.length} ${active.length === 1 ? "arrival" : "arrivals"} in motion.`
              : "Your arrivals, together."}
          </p>
        </div>
        <button className="button top-create" onClick={onCreate}>
          <Plus size={20} /> Create Greet
        </button>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="stats">
            {[
              [Radio, "Active", active.length],
              [
                Plane,
                "Today",
                greets.filter(
                  (g) => g.date === localDate && !ended.includes(g.state),
                ).length,
              ],
              [
                Check,
                "Completed",
                greets.filter((g) => g.state === "COMPLETED").length,
              ],
            ].map(([Icon, name, count]) => (
              <div
                className={"stat " + (name === "Active" && count ? "hot" : "")}
                key={name}
              >
                <div className="stat-label">
                  <Icon size={15} />
                  <span>{name}</span>
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {page === "home" && (
            <button className="create-tile" onClick={onCreate}>
              <div className="create-symbol">
                <Plus size={28} />
              </div>
              <div>
                <span className="tile-overline">
                  A GREAT ARRIVAL STARTS HERE
                </span>
                <h2>Create a Greet</h2>
                <p>One link. A familiar face. A better hello.</p>
              </div>
              <ArrowUpRight className="create-arrow" size={28} />
              <div className="tile-orbit" aria-hidden="true" />
            </button>
          )}
          <section className="greet-list">
            <div className="list-heading">
              <h2>
                {page === "home" ? "Your Greets" : "All arrivals"}{" "}
                <span>{filtered.length}</span>
              </h2>
              <button className="text-button" onClick={onAllGreets}>
                View all <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="list-toolbar">
              <div className="tabs" role="tablist" aria-label="Filter Greets">
                {["Active", "Today", "Upcoming", "Recent"].map((name) => (
                  <button
                    key={name}
                    role="tab"
                    aria-selected={filter === name}
                    className={filter === name ? "active" : ""}
                    onClick={() => setFilter(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Find a guest"
                  placeholder="Find a guest"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="cards">
              {filtered.map((item, i) => {
                const isLive = [
                  "PASSENGER_READY",
                  "LIVE_GREET",
                  "NEARBY",
                  "VERY_CLOSE",
                  "MEETING_CONFIRMATION",
                ].includes(item.state);
                return (
                  <button
                    className={"greet-card " + (isLive ? "is-live" : "")}
                    key={item.id}
                    onClick={() => onOpen(item)}
                  >
                    <div className="greet-card-top">
                      {item.photo ? (
                        <img className="avatar" src={item.photo} alt="" />
                      ) : (
                        <div className="avatar">
                          {item.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                      )}
                      <div className="card-person">
                        <span className="micro-label">PASSENGER</span>
                        <h3>{item.name}</h3>
                      </div>
                      <ChevronRight className="card-chevron" size={19} />
                    </div>
                    <div className="card-journey">
                      <div>
                        <span className="micro-label">
                          <Plane size={12} /> FLIGHT
                        </span>
                        <b>{item.flight || "Personal pickup"}</b>
                        <small>{item.airport}</small>
                      </div>
                      <div>
                        <span className="micro-label">
                          <Clock size={12} /> ARRIVAL
                        </span>
                        <b>{arrivalTime(item) || "Not set"}</b>
                        <small>
                          {item.terminal || "Meeting point arranged"}
                        </small>
                      </div>
                    </div>
                    <div className="card-bottom">
                      <span className={"status " + (isLive ? "green" : "")}>
                        <span />
                        {statuses[item.state] ||
                          item.state.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="card-open">
                        Open Greet <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </button>
                );
              })}
              {!filtered.length && (
                <div className="empty">
                  <div className="empty-radar">
                    <span />
                    <span />
                    <MapPin size={28} />
                    <i />
                  </div>
                  <h3>
                    {query
                      ? "No matching guests."
                      : filter === "Recent"
                        ? "Every hello leaves a story."
                        : "You’re ready for your next hello."}
                  </h3>
                  <p>
                    {query
                      ? "Try another name."
                      : filter === "Recent"
                        ? "Your completed Greets will appear here."
                        : "Add a guest and send their personal pickup link."}
                  </p>
                  {!query && (
                    <button className="text-button" onClick={onCreate}>
                      Create {greets.length ? "a" : "your first"} Greet{" "}
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
          <div className="bottom-note">
            <ShieldCheck size={16} />
            <p>Location sharing starts with you. Ends when you meet.</p>
          </div>
        </div>
        <div className="dashboard-companion">
          <div className="companion-heading">
            <span className="micro-label">RECOGNITION, REIMAGINED</span>
            <ScanLine size={17} />
          </div>
          <button
            className="signature-preview"
            onClick={() => (next ? onOpen(next) : onPreview())}
            aria-label={next ? "Open next Greet" : "Preview GreetBoard"}
          >
            <div className="preview-top">
              <span>GREETBOARD</span>
              <Maximize2 size={16} />
            </div>
            <div className="preview-sign">
              <BeaconStars />
              <div className="preview-name">
                {next ? (
                  next.name
                    .toUpperCase()
                    .split(" ")
                    .map((word, i) => <span key={i}>{word}</span>)
                ) : (
                  <>
                    <span>YOUR</span>
                    <span>NEXT</span>
                    <span>HELLO.</span>
                  </>
                )}
              </div>
              <p>{next ? next.flight : "Impossible to miss."}</p>
            </div>
            <div className="preview-bottom">
              <span className="preview-dot" />{" "}
              {next ? "Your next arrival" : "GreetBoard preview"}
              <ArrowUpRight size={17} />
            </div>
          </button>
          <div className="how-it-works">
            <div>
              <span>01</span>
              <p>
                <b>Create.</b> Add your guest.
              </p>
              <Users size={16} />
            </div>
            <div>
              <span>02</span>
              <p>
                <b>Share.</b> Send one secure link.
              </p>
              <ArrowUpRight size={16} />
            </div>
            <div>
              <span>03</span>
              <p>
                <b>Meet.</b> Find each other.
              </p>
              <MapPin size={16} />
            </div>
          </div>
          <div className="guest-note">
            <div className="guest-note-icon">
              <ShieldCheck size={18} />
            </div>
            <p>
              No download.
              <br />
              <b>Just a warm welcome.</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
