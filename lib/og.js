/* Share images (1200 × 630) for airport pages, drawn on demand and cached.
   WhatsApp, Facebook, LinkedIn and Google Discover all use this picture. */
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";

const FONTS = ["Fraunces-Black.ttf", "Fraunces-Black-ext.ttf", "Geist-SemiBold.ttf", "Geist-Medium.ttf"].map((f) =>
  path.resolve("website/fonts", f),
);
const esc = (v = "") => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Break a long airport name into at most two balanced lines.
function lines(text, max = 13) {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  let best = [text];
  let score = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const s = Math.max(a.length, b.length);
    if (s < score) (score = s), (best = [a, b]);
  }
  return best;
}

export function ogSvg({ kicker, place, city, code }) {
  const l = lines(`${place} Airport`);
  const longest = Math.max(...l.map((x) => x.length));
  const size = longest > 20 ? 50 : longest > 16 ? 58 : longest > 13 ? 68 : 82;
  const pin = (x, y, s, fill) =>
    `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" d="M9 0C4 0 0 4 0 9c0 6.6 7.6 14.1 8.3 14.7.4.4 1 .4 1.4 0C10.4 23.1 18 15.6 18 9c0-5-4-9-9-9zm0 12.6A3.6 3.6 0 1 1 9 5.4a3.6 3.6 0 0 1 0 7.2z"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="g" cx="0.3" cy="0" r="0.9"><stop offset="0" stop-color="#1a46c4"/><stop offset="1" stop-color="#002fa7"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="72" y="104" font-family="Geist" font-weight="600" font-size="22" letter-spacing="3" fill="#ffffff" fill-opacity="0.72">${esc(kicker.toUpperCase())}</text>
  <text x="72" y="178" font-family="Geist" font-weight="500" font-size="36" fill="#ffffff" fill-opacity="0.9">Meeting someone at</text>
  ${l.map((t, i) => `<text x="68" y="${262 + i * (size + 6)}" font-family="Fraunces Black" font-size="${size}" letter-spacing="-2" fill="#ffffff">${esc(t)}</text>`).join("")}
  <g transform="translate(72 540)">${pin(0, -26, 1.25, "#ffffff")}<text x="34" y="0" font-family="Geist" font-weight="600" font-size="30" fill="#ffffff">arigreet.com</text></g>
  <g transform="translate(760 150) rotate(-6 180 170)">
    <rect width="380" height="250" rx="40" fill="#0d0f16"/>
    <rect x="12" y="12" width="356" height="226" rx="30" fill="#ffffff"/>
    <text x="190" y="70" text-anchor="middle" font-family="Geist" font-weight="600" font-size="18" fill="#4a5170">Welcome to ${esc(city.length > 18 ? city.slice(0, 17) + "…" : city)}</text>
    <text x="190" y="150" text-anchor="middle" font-family="Fraunces Black" font-size="58" letter-spacing="-1.5" fill="#002fa7">${esc(code)}</text>
    ${pin(170, 188, 0.9, "#002fa7")}
  </g>
</svg>`;
}

const cache = new Map();
export function ogPng(data) {
  const key = data.code;
  if (cache.has(key)) return cache.get(key);
  const png = new Resvg(ogSvg(data), {
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Geist" },
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();
  if (cache.size > 2000) cache.clear();
  cache.set(key, png);
  return png;
}
