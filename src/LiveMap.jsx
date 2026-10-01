import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

/* Live map that moves like a delivery app: each new position glides in over
   about two seconds, the other person's marker turns to face the way they're
   walking, a dotted route joins you, and the distance rides on the line. */

const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const initials = (n = "") =>
  n
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const metres = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const bearing = (a, b) => {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const ease = (t) => 1 - Math.pow(1 - t, 3);
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const meIcon = () =>
  L.divIcon({
    className: "lm-me",
    html: `<span class="lm-me-halo"></span><span class="lm-me-dot"></span><b>YOU</b>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
const peerIcon = (name, photo) =>
  L.divIcon({
    className: "lm-peer",
    html:
      `<span class="lm-peer-pulse"></span><span class="lm-peer-arrow"></span>` +
      `<span class="lm-peer-face">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(name))}</span>` +
      `<b>${esc((name || "").split(" ")[0])}</b>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
const distIcon = (m) =>
  L.divIcon({ className: "lm-dist", html: `<span>${m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km"}</span>`, iconSize: [0, 0] });

function Layer({ positions, role, peer, peerPhoto }) {
  const map = useMap();
  const st = useRef(null);
  if (!st.current) st.current = { shown: {}, from: {}, to: {}, start: 0, markers: {}, trail: [], heading: null };

  // Build layers once
  useEffect(() => {
    const s = st.current;
    s.route = L.polyline([], { className: "lm-route", weight: 4, dashArray: "2 10", lineCap: "round" }).addTo(map);
    s.trailLine = L.polyline([], { className: "lm-trail", weight: 6, lineCap: "round" }).addTo(map);
    s.acc = L.circle([0, 0], { radius: 1, className: "lm-acc", weight: 1 });
    s.dist = L.marker([0, 0], { icon: distIcon(0), interactive: false, keyboard: false });
    let raf;
    const tick = (t) => {
      const k = s.start ? Math.min(1, (t - s.start) / 2000) : 1;
      for (const r of Object.keys(s.to)) {
        const a = s.from[r] || s.to[r];
        const b = s.to[r];
        const p = { lat: a.lat + (b.lat - a.lat) * ease(k), lng: a.lng + (b.lng - a.lng) * ease(k) };
        s.shown[r] = p;
        s.markers[r]?.setLatLng(p);
      }
      const mine = s.shown[role];
      const theirs = s.shown[role === "guest" ? "greeter" : "guest"];
      if (mine && s.acc._map) s.acc.setLatLng(mine);
      if (mine && theirs) {
        s.route.setLatLngs([theirs, mine]);
        const d = metres(mine, theirs);
        s.dist.setLatLng({ lat: (mine.lat + theirs.lat) / 2, lng: (mine.lng + theirs.lng) / 2 });
        const label = d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km";
        if (s.distLabel !== label) {
          s.distLabel = label;
          s.dist.setIcon(distIcon(d));
        }
        if (!s.dist._map) s.dist.addTo(map);
        s.trailLine.setLatLngs([...s.trail, theirs]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      [s.route, s.trailLine, s.acc, s.dist, ...Object.values(s.markers)].forEach((l) => l.remove());
      s.markers = {};
    };
  }, [map, role]);

  // New positions arrive every few seconds: glide from where the marker is now.
  const sig = Object.entries(positions)
    .map(([r, p]) => r + p.latitude.toFixed(6) + p.longitude.toFixed(6))
    .join("|");
  useEffect(() => {
    const s = st.current;
    const peerRole = role === "guest" ? "greeter" : "guest";
    for (const [r, p] of Object.entries(positions)) {
      const next = { lat: p.latitude, lng: p.longitude };
      const prev = s.to[r];
      s.from[r] = reduced() ? next : s.shown[r] || next;
      s.to[r] = next;
      if (!s.markers[r]) {
        s.markers[r] = L.marker(next, {
          icon: r === role ? meIcon() : peerIcon(peer, peerPhoto),
          keyboard: false,
          zIndexOffset: r === role ? 0 : 500,
        }).addTo(map);
      }
      if (r === peerRole && prev && metres(prev, next) > 1.5) {
        s.heading = bearing(prev, next);
        s.trail = [...s.trail, prev].slice(-12);
        const el = s.markers[r].getElement()?.querySelector(".lm-peer-arrow");
        if (el) {
          el.style.transform = `rotate(${s.heading}deg)`;
          el.style.opacity = "1";
        }
      }
      if (r === role) {
        if (!s.acc._map) s.acc.addTo(map);
        s.acc.setRadius(Math.max(3, Math.min(p.accuracy || 10, 80)));
      }
    }
    for (const r of Object.keys(s.markers))
      if (!positions[r]) {
        s.markers[r].remove();
        delete s.markers[r];
        delete s.to[r];
        delete s.shown[r];
      }
    s.start = performance.now();
    // Camera: keep both people in view, easing like the markers.
    const pts = Object.values(positions).map((p) => [p.latitude, p.longitude]);
    if (pts.length > 1) map.flyToBounds(pts, { padding: [64, 64], maxZoom: 18, duration: reduced() ? 0 : 1.2 });
    else if (pts.length) map.flyTo(pts[0], Math.max(map.getZoom(), 17), { duration: reduced() ? 0 : 1 });
  }, [sig]);
  return null;
}

/* Tile provider comes from the server (MapTiler in production, OSM in dev). */
let tiles = null;
const loadTiles = () =>
  (tiles ||= fetch("/api/config")
    .then((r) => r.json())
    .then((c) => c.map)
    .catch(() => ({ url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" })));

export default function LiveMap({ id, positions, role, peer, peerPhoto }) {
  const pts = Object.values(positions);
  const [map, setMap] = useState(null);
  useEffect(() => {
    loadTiles().then(setMap);
  }, []);
  return (
    <MapContainer
      key={id}
      center={[pts[0].latitude, pts[0].longitude]}
      zoom={17}
      maxZoom={19}
      zoomControl={false}
      attributionControl={true}
      className="live-map"
    >
      {map && <TileLayer attribution={map.attribution} url={map.url} maxZoom={19} />}
      <Layer positions={positions} role={role} peer={peer} peerPhoto={peerPhoto} />
    </MapContainer>
  );
}
