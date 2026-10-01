import { resetDb, sim, demoToken, latestGuestToken, sessionOwner } from "./mock.js";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "../src/main.jsx";

const session = () => {
  try {
    return JSON.parse(localStorage.getItem("arigreet-session") || "null");
  } catch {
    return null;
  }
};

function Preview() {
  const [mode, setMode] = useState("greeter");
  const [run, setRun] = useState(0);
  const go = (next, token) => {
    sim.clear();
    sim.viewer = next;
    window.__arigreetGuest = next === "guest" ? token : null;
    setMode(next);
    setRun((r) => r + 1);
  };
  useEffect(() => {
    window.__arigreetOpen = (url) => go("guest", url.split("/")[2]);
    const on = (e) => {
      if (e.data !== "arigreet-replay") return;
      localStorage.removeItem("arigreet-session");
      localStorage.removeItem("arigreet-intro-seen");
      localStorage.removeItem("arigreet-draft-v2");
      localStorage.removeItem("arigreet-started");
      resetDb();
      go("greeter");
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);
  const toggle = () => {
    if (mode === "guest") return go("greeter");
    const owner = sessionOwner(session()?.token);
    go("guest", owner ? latestGuestToken(owner) : demoToken());
  };
  return (
    <>
      <App key={run} />
      <button className="pv-switch" onClick={toggle} aria-label="Switch demo view">
        {mode === "guest" ? "Passenger view" : "Greeter view"} <span>⇄</span>
      </button>
    </>
  );
}
createRoot(document.getElementById("root")).render(<Preview />);
