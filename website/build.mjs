// Builds arigreet.com into website/dist:
//   /                       home
//   /<keyword>/             one page per search term (website/src/pages.mjs)
//   /airports/              every airport with scheduled flights, by continent
//   /airports/<country>/    airports in one country
//   /airports/<iata>/       one arrivals guide per airport (3,840)
//   sitemap.xml, robots.txt
// Every page carries the airport greeting board generator.
// Run: node website/build.mjs   (npm run build does it after the app build)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, GROUPS } from "./src/pages.mjs";
import { TERMINALS, POPULAR } from "../src/terminals.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = path.join(here, "dist");
const SITE = (process.env.SITE_URL || "https://arigreet.com").replace(/\/$/, "");
const YEAR = new Date().getFullYear();

const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Responsive photos: website/src/img/<name>-<width>.webp
const IMG_DIR = path.join(here, "src/img");
const IMG_WIDTHS = {};
for (const f of readdirSync(IMG_DIR)) {
  const m = f.match(/^(.+)-(\d+)\.webp$/);
  if (m) (IMG_WIDTHS[m[1]] ||= []).push(+m[2]);
}
const SIZES = {
  hero: "(max-width: 1000px) 100vw, 980px",
  wide: "(max-width: 860px) 100vw, 50vw",
  half: "(max-width: 700px) 100vw, 50vw",
  card: "(max-width: 700px) 100vw, 560px",
  page: "(max-width: 900px) 100vw, 45vw",
  bleed: "100vw",
  thumb: "(max-width: 900px) 180px, 18vw",
  ribbon: "(max-width: 700px) 300px, 450px",
};
const img = (name, alt, kind = "card") => {
  const ws = (IMG_WIDTHS[name] || []).sort((a, b) => a - b);
  if (!ws.length) throw Error("Missing photo " + name);
  const mid = ws.find((w) => w >= 1024) || ws.at(-1);
  const eager = kind === "hero";
  return `<img src="/site/img/${name}-${mid}.webp" srcset="${ws.map((w) => `/site/img/${name}-${w}.webp ${w}w`).join(", ")}" sizes="${SIZES[kind]}" width="1536" height="1024" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
// Hero photo ribbon: a row of real moments that drifts past, Linktree-style.
const RIBBON = [
  ["reunion", "A mother walking out of Arrivals with open arms", "w"],
  ["greeter-board", "A driver holding up a phone greeting board at Arrivals", "t"],
  ["look-up", "Friends hugging at Arrivals", "w"],
  ["chauffeur", "A chauffeur opening the car door for a traveller", "t"],
  ["island-family", "A family arriving at a Greek island airport", "w"],
  ["lost", "A traveller looking for the person meeting her", "t"],
  ["landed", "A passenger tapping I've landed on her phone", "w"],
  ["barrier", "Drivers waiting at the arrivals barrier", "t"],
  ["flatlay", "Passport, boarding pass and a phone showing a Greet", "w"],
];
const ribbon = () => {
  const card = ([n, alt, shape], dup, i) => {
    const ws = (IMG_WIDTHS[n] || []).filter((w) => w >= 480 && w <= 1024).sort((a, b) => a - b);
    return `<figure class="rb-card rb-${shape}"><img src="/site/img/${n}-480.webp" srcset="${ws.map((w) => `/site/img/${n}-${w}.webp ${w}w`).join(", ")}" sizes="${SIZES.ribbon}" width="480" height="320" alt="${dup ? "" : esc(alt)}" ${dup || i > 2 ? 'loading="lazy" ' : ""}fetchpriority="low" decoding="async"></figure>`;
  };
  return `<div class="x-ribbon">
      <div class="rb-track">${RIBBON.map((r, i) => card(r, false, i)).join("")}</div>
      <div class="rb-track" aria-hidden="true">${RIBBON.map((r, i) => card(r, true, i)).join("")}</div>
      <div class="x-chip k1"><i></i>Helen has landed</div>
      <div class="x-chip k2"><i></i>40 m away · Exit 3</div>
    </div>`;
};
const fillImgs = (html) => html.replace(/\{\{IMG:([^|}]+)\|([^|}]+)\|([^}]+)\}\}/g, (_, n, alt, kind) => img(n, alt, kind));
// One photo per page group.
const GROUP_PHOTO = {
  service: ["chauffeur", "A chauffeur opening the car door for a traveller outside the terminal at dusk"],
  tool: ["greeter-board", "A driver at Arrivals holding up a phone with a Klein Blue greeting board"],
  guide: ["lost", "A traveller standing still in a busy terminal, looking around for the person meeting her"],
  pro: ["chauffeur", "A chauffeur greeting a business traveller at the airport kerb"],
  home: ["island-family", "A family walking out of a Greek island airport, waved at by the relative picking them up"],
};

// ── Airport data ───────────────────────────────────
// Every airport with scheduled passenger flights and an IATA code
// (OurAirports, public domain; time zones from airportsdata, MIT).
const AD = JSON.parse(readFileSync(path.join(here, "data/airports.json"), "utf8"));
const slugify = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const AIRPORTS = AD.airports.map((r) => {
  const a = Object.fromEntries(AD.fields.map((f, i) => [f, r[i]]));
  a.slug = a.iata.toLowerCase();
  a.terminals = TERMINALS[a.iata] || null;
  a.countrySlug = slugify(a.countryName);
  return a;
});
const BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));
const CITY_COUNT = new Map();
for (const a of AIRPORTS) CITY_COUNT.set(a.country + "|" + a.city, (CITY_COUNT.get(a.country + "|" + a.city) || 0) + 1);
const DOMESTIC = new Map();
for (const a of AIRPORTS) DOMESTIC.set(a.country, (DOMESTIC.get(a.country) || 0) + 1);
const cityOf = (a) => a.city || a.municipality || a.name.replace(/ (International )?Airport.*$/i, "");
// "London Heathrow" where a city has several airports, plain "Skiathos" where it has one.
const placeOf = (a) => {
  const city = cityOf(a);
  if ((CITY_COUNT.get(a.country + "|" + a.city) || 0) < 2) return city;
  const short = a.name
    .replace(/\b(International|Intercontinental|Regional|Municipal|National)\b/gi, "")
    .replace(/\bAirport\b/gi, "")
    .replace(new RegExp("\\b" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), "")
    .replace(/[-–,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return short ? `${city} ${short}` : `${city} ${a.iata}`;
};
const SIZE = { L: "Major airport", M: "Regional airport", S: "Small airport" };
const SIZE_ORDER = { L: 0, M: 1, S: 2 };
const CONTINENTS = { EU: "Europe", AF: "Africa", AS: "Asia", NA: "North America", SA: "South America", OC: "Oceania", AN: "Antarctica" };
const SCHENGEN = new Set("AT BE BG CH CZ DE DK EE ES FI FR GR HR HU IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK".split(" "));
// "Welcome" in the local language, for the line above the name.
const WELCOME = {
  GR: ["Καλώς ήρθατε", "Greek"], CY: ["Καλώς ήρθατε", "Greek"], FR: ["Bienvenue", "French"],
  ES: ["Bienvenidos", "Spanish"], MX: ["Bienvenidos", "Spanish"], AR: ["Bienvenidos", "Spanish"], CO: ["Bienvenidos", "Spanish"],
  CL: ["Bienvenidos", "Spanish"], PE: ["Bienvenidos", "Spanish"], IT: ["Benvenuti", "Italian"], DE: ["Willkommen", "German"],
  AT: ["Willkommen", "German"], PT: ["Bem-vindos", "Portuguese"], BR: ["Bem-vindos", "Portuguese"],
  NL: ["Welkom", "Dutch"], TR: ["Hoş geldiniz", "Turkish"], PL: ["Witamy", "Polish"], SE: ["Välkommen", "Swedish"],
  NO: ["Velkommen", "Norwegian"], DK: ["Velkommen", "Danish"], FI: ["Tervetuloa", "Finnish"], HR: ["Dobrodošli", "Croatian"],
  RO: ["Bun venit", "Romanian"], CZ: ["Vítejte", "Czech"], HU: ["Üdvözöljük", "Hungarian"], JP: ["ようこそ", "Japanese"],
  KE: ["Karibu", "Swahili"], TZ: ["Karibu", "Swahili"], AE: ["أهلاً وسهلاً", "Arabic"], EG: ["أهلاً وسهلاً", "Arabic"],
  MA: ["مرحبا", "Arabic"], QA: ["أهلاً وسهلاً", "Arabic"], SA: ["أهلاً وسهلاً", "Arabic"], ID: ["Selamat datang", "Indonesian"],
  MY: ["Selamat datang", "Malay"], TH: ["ยินดีต้อนรับ", "Thai"], KR: ["환영합니다", "Korean"], CN: ["欢迎", "Chinese"],
  IL: ["ברוכים הבאים", "Hebrew"], 
};
const km = (a, b) => {
  const R = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * R) / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const utcOffset = (tz) => {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    return p.find((x) => x.type === "timeZoneName")?.value.replace("GMT", "UTC") || "";
  } catch {
    return "";
  }
};
// Indexing in waves (the OwnBio launch gate): Google sees the strongest pages first.
// Wave 1: every major airport and every airport with checked terminal data.
// Set INDEX_ALL_AIRPORTS=1 to open the rest once Search Console shows them doing well.
const INDEX_ALL = process.env.INDEX_ALL_AIRPORTS === "1";
const indexable = (a) => INDEX_ALL || a.size === "L" || !!a.terminals;
const listJoin = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs.at(-1));

// ── Shared pieces ──────────────────────────────────
const PIN = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="pin" viewBox="0 0 18 24"><path d="M9 0C4 0 0 4 0 9c0 6.6 7.6 14.1 8.3 14.7.4.4 1 .4 1.4 0C10.4 23.1 18 15.6 18 9c0-5-4-9-9-9zm0 12.6A3.6 3.6 0 1 1 9 5.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor"/></symbol></defs></svg>`;

const head = ({ title, description, url, jsonld = [], noindex = false, image = "/site/img/share.jpg", inlineCss = "" }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${url}">
<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
<meta name="theme-color" content="#002fa7">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Arigreet">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}${image}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/site/fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/site/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin>
${inlineCss ? `<style>${inlineCss}</style>` : `<link rel="stylesheet" href="/site/site.css">`}
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
${PIN}`;

const nav = () => `<header class="nav">
  <div class="nav-pill">
    <a class="logo" href="/" style="color: var(--ikb)"><svg><use href="#pin"/></svg><span style="color: var(--ink)">Arigreet</span></a>
    <nav class="nav-links" aria-label="Main">
      <a href="/#how">How it works</a>
      <a href="/for/chauffeurs/">For drivers</a>
      <a href="/airports/">Airports</a>
      <a href="/airport-greeting-board/">Greeting board</a>
    </nav>
    <a class="btn btn-ikb" href="/app">Create a Greet</a>
  </div>
</header>`;

const footMap = () => {
  const cols = Object.entries(GROUPS).map(
    ([g, label]) => `<div><h3 class="fm-h">${esc(label)}</h3><ul>${PAGES.filter((p) => p.group === g)
      .map((p) => `<li><a href="/${p.slug}/">${esc(p.nav)}</a></li>`)
      .join("")}</ul></div>`,
  );
  const top = POPULAR.map((c) => BY_IATA.get(c)).filter(Boolean).slice(0, 10);
  cols.push(
    `<div><h3 class="fm-h">Airports</h3><ul>${top.map((a) => `<li><a href="/airports/${a.slug}/">${esc(placeOf(a))} (${a.iata})</a></li>`).join("")}<li><a href="/airports/">All airport guides</a></li></ul></div>`,
  );
  return `<div class="foot-map">${cols.join("")}</div>
      <footer class="foot">
        <span>© ${YEAR} Arigreet · arigreet.com</span>
        <nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:hello@arigreet.com">hello@arigreet.com</a></nav>
      </footer>`;
};

const sendoff = (line = "See you at Arrivals.") => `<section class="sendoff">
    <div class="wrap">
      <h2 class="serif">${esc(line)}</h2>
      <p>Your next pickup takes one minute to set up.</p>
      <a class="btn btn-white btn-lg" href="/app">Create a Greet</a>
      ${footMap()}
    </div>
  </section>`;

const tail = () => `<script src="/site/site.js" defer></script>
</body>
</html>
`;

// The airport greeting board generator. Same tool on every page, tuned per page.
const gen = ({ title = "Airport greeting board generator", text = "Type their name, pick a colour, and hold it up at Arrivals. Or turn it into a live Greet so they can find you and make it flash.", top = "Welcome", name = "Helen Smith", airport = "", headingTag = "h2", white = false } = {}) => `<section class="gen-sec${white ? " on-white" : ""}" id="board" aria-labelledby="gen-title">
    <div class="wrap">
      <div class="gen-head">
        <${headingTag} id="gen-title" class="serif">${esc(title)}</${headingTag}>
        <p>${esc(text)}</p>
      </div>
      <div class="gen" data-gen>
        <form class="gen-form">
          <label class="fld" for="g-name"><span>Name on the board</span><input id="g-name" autocomplete="off" maxlength="60" value="${esc(name)}"></label>
          <label class="fld" for="g-top"><span>Line above the name (optional)</span><input id="g-top" autocomplete="off" maxlength="50" value="${esc(top)}" placeholder="Welcome, a company or a group"></label>
          <label class="fld" for="g-airport"><span>Airport code (optional)</span><input id="g-airport" autocomplete="off" maxlength="3" value="${esc(airport)}" placeholder="ATH" style="text-transform:uppercase"></label>
          <fieldset class="fld" style="border:0;margin:0;padding:0">
            <span>Colour</span>
            <div class="swatches">
              <label class="swatch" style="--sw:#002fa7"><input type="radio" name="g-style" value="klein" checked><span>Klein Blue</span></label>
              <label class="swatch" style="--sw:#ffffff"><input type="radio" name="g-style" value="light"><span>White</span></label>
              <label class="swatch" style="--sw:#0b0d12"><input type="radio" name="g-style" value="dark"><span>Black</span></label>
            </div>
          </fieldset>
          <div class="gen-actions">
            <a class="btn btn-ikb btn-lg" data-create href="/app">Create a Greet with this board</a>
            <div class="row">
              <button type="button" class="btn btn-soft" data-full>Show full screen</button>
              <button type="button" class="btn btn-soft" data-png>Download image</button>
            </div>
          </div>
        </form>
        <div class="gen-preview" aria-label="Board preview">
          <div class="device">
            <div class="board" data-style="klein">
              <div class="board-top">${esc(top)}</div>
              <div class="board-name">${esc(name)}</div>
              <div class="board-foot"><svg><use href="#pin"/></svg><span>arigreet.com</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

const crumbs = (items) =>
  `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map(([label, href], i) => (href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`) + (i < items.length - 1 ? " <span aria-hidden=\"true\">/</span>" : ""))
    .join(" ")}</nav>`;
const crumbLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + (href || "") })),
});
const faqLd = (faq) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});
const faqHtml = (faq) =>
  faq.map(([q, a], i) => `<details class="qa"><summary>${esc(q)}<i></i></summary><p>${esc(a)}</p></details>`).join("\n");
const blockHtml = (b) =>
  `<div class="prose-block" id="${esc(b.h.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}"><h2>${esc(b.h)}</h2><div class="prose-body">${(b.p || [])
    .map((t) => `<p>${esc(t)}</p>`)
    .join("")}${b.list ? `<ul>${b.list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}</div></div>`;

const related = (cur, n = 6) => {
  const same = PAGES.filter((p) => p.slug !== cur.slug && p.group === cur.group);
  const other = PAGES.filter((p) => p.slug !== cur.slug && p.group !== cur.group);
  return [...same, ...other].slice(0, n);
};
const appLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Arigreet",
  applicationCategory: "TravelApplication",
  operatingSystem: "Web, Android",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  description: "Airport meet and greet app: one link for the passenger, arrival alerts, live finding and a digital greeting board.",
  url: SITE,
};

// Small, safe CSS minifier: comments, whitespace around punctuation.
const minCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();

// ── Writers ────────────────────────────────────────
const pages = [];
const write = (url, html, priority = 0.6, map = "pages") => {
  const dir = path.join(out, url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
  pages.push({ url, priority, map });
};

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "site"), { recursive: true });
const SITE_CSS = minCss(["fonts.css", "base.css", "extra.css", "home.css"].map((f) => readFileSync(path.join(here, "src", f), "utf8")).join("\n"));
writeFileSync(path.join(out, "site/site.css"), SITE_CSS);
writeFileSync(path.join(out, "site/site.js"), readFileSync(path.join(here, "src/site.js"), "utf8"));
cpSync(IMG_DIR, path.join(out, "site/img"), { recursive: true });
cpSync(path.join(here, "src/fonts"), path.join(out, "site/fonts"), { recursive: true });

// Home
{
  const body = readFileSync(path.join(here, "src/home.html"), "utf8")
    .replace("{{GEN}}", gen({ white: false }))
    .replace("{{FOOT}}", footMap())
    .replace("{{RIBBON}}", ribbon());
  const bodyImgs = fillImgs(body);
  write(
    "/",
    head({
      title: "Arigreet · Airport Meet and Greet App · Find Each Other at Arrivals",
      description: "Send one link, see when they land, follow them to the exit and hold up a digital pickup sign. No download for them. Works at 7,884 airports.",
      url: "/",
      jsonld: [appLd],
      inlineCss: SITE_CSS,
    }) + nav() + bodyImgs + tail(),
    1.0,
  );
}

// Keyword pages
for (const p of PAGES) {
  const url = `/${p.slug}/`;
  const trail = [["Home", "/"], ...(p.slug.includes("/") ? [[GROUPS[p.group], p.slug.startsWith("guides/") ? "/guides/" : "/for/"]] : []), [p.nav, url]];
  const html =
    head({ title: p.title, description: p.description, url, jsonld: [appLd, faqLd(p.faq), crumbLd(trail)] }) +
    nav() +
    `<main id="top">
  <section class="page-hero">
    <div class="wrap page-hero-grid">
      <div>
      ${crumbs(trail.map(([l, h], i) => [l, i === trail.length - 1 ? "" : h]))}
      <span class="eyebrow">${esc(p.eyebrow)}</span>
      <h1 class="serif">${esc(p.h1)}</h1>
      <p class="lede">${esc(p.lede)}</p>
      <div class="hero-cta"><a class="btn btn-white btn-lg" href="#board">Make the greeting board</a><a class="btn btn-ghost-w btn-lg" href="/app">Create a Greet</a></div>
      </div>
      <figure class="page-photo">${img(...(p.photo || GROUP_PHOTO[p.group]), "hero")}</figure>
    </div>
  </section>
  ${gen({ top: p.top, white: false })}
  <section class="prose">
    <div class="wrap prose-grid">
      <aside><span class="eyebrow">On this page</span><ul class="toc">${p.blocks
        .map((b) => `<li><a href="#${b.h.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${esc(b.h)}</a></li>`)
        .join("")}<li><a href="#faq">Questions</a></li></ul></aside>
      <div>${p.blocks.map(blockHtml).join("\n")}</div>
    </div>
  </section>
  <section class="faq" id="faq">
    <div class="wrap faq-grid">
      <div><h2 class="serif">Frequently asked questions</h2><p class="faq-lede">Everything you need to know before getting started.</p></div>
      <div>${faqHtml(p.faq)}</div>
    </div>
  </section>
  <section class="links-sec">
    <div class="wrap">
      <h2 class="serif">Keep reading</h2>
      <div class="link-grid">${related(p)
        .map((r) => `<a class="link-card" href="/${r.slug}/"><b>${esc(r.nav)}</b><span>${esc(r.description.slice(0, 90))}…</span></a>`)
        .join("")}</div>
    </div>
  </section>
  ${sendoff()}
</main>` +
    tail();
  write(url, html, p.group === "service" ? 0.9 : 0.8);
}

// Group hubs: /guides/ and /for/
for (const [hub, groups, title, h1] of [
  ["/guides/", ["guide"], "Airport Pickup Guides · Arigreet", "Guides for meeting someone at the airport."],
  ["/for/", ["pro", "home"], "Who Uses Arigreet · Drivers, Hotels and Families", "Arigreet for drivers, hotels and families."],
]) {
  const list = PAGES.filter((p) => groups.includes(p.group));
  write(
    hub,
    head({ title, description: h1, url: hub }) +
      nav() +
      `<main id="top"><section class="page-hero"><div class="wrap">${crumbs([["Home", "/"], [h1, ""]])}<h1 class="serif">${esc(h1)}</h1></div></section>
      ${gen({})}
      <section class="links-sec"><div class="wrap"><div class="link-grid">${list
        .map((r) => `<a class="link-card" href="/${r.slug}/"><b>${esc(r.nav)}</b><span>${esc(r.lede)}</span></a>`)
        .join("")}</div></div></section>${sendoff()}</main>` +
      tail(),
    0.7,
  );
}

// ── Airport guides: one page per airport with scheduled flights ──
// Every sentence comes from real data about that airport (size, terminals,
// time zone, border rules, neighbours, links) so no two pages read alike.
const nearby = (a) =>
  AIRPORTS.filter((b) => b.iata !== a.iata)
    .map((b) => ({ b, d: km(a, b) }))
    .filter((x) => x.d <= 250)
    .sort((x, y) => x.d - y.d)
    .slice(0, 8);
const borderText = (a) => {
  const c = a.country;
  if (SCHENGEN.has(c))
    return `${a.countryName} is in the Schengen area. Passengers on flights from other Schengen countries walk straight out with no passport check, often within 15 to 25 minutes. Flights from outside Schengen, including the UK, go through passport control first, which can add 20 to 60 minutes at busy times.`;
  if (c === "GB")
    return "Arrivals from abroad go through UK Border Force passport control. Many passport holders can use the eGates, but queues still add 15 to 60 minutes at peak times. Domestic flights from elsewhere in the UK skip passport control.";
  if (c === "IE")
    return "Flights from outside Ireland go through passport control. Flights from the UK are in the Common Travel Area, which usually means a quicker check.";
  if (c === "US")
    return "International arrivals clear US Customs and Border Protection before they reach the arrivals hall, which can take anywhere from 30 minutes to two hours. Domestic flights have no passport control, so passengers can be out within 15 minutes with hand luggage.";
  if (c === "CA")
    return "International arrivals clear Canada Border Services before they come out. Domestic flights skip it.";
  return `International arrivals go through passport control and customs before the arrivals hall.${(DOMESTIC.get(c) || 0) > 1 && !["SG", "HK", "MO", "QA", "BH", "KW"].includes(c) ? ` Domestic flights within ${a.countryName} are usually much quicker.` : ""}`;
};
const sizeText = (a, city) => {
  if (a.terminals?.length > 1)
    return `${a.name} has ${a.terminals.length} arrival terminals: ${listJoin(a.terminals)}. Each has its own arrivals area, so waiting at the wrong one is the most common mix-up here. The terminal is on their booking or in the airline's app. Check it before you set off and put it in your Greet.`;
  if (a.terminals?.length === 1)
    return `${a.name} has one passenger terminal, so everyone comes out into the same arrivals area. That makes meeting simpler, and busier when several flights land together. Agree one exact spot in the hall.`;
  if (a.size === "L")
    return `${a.name} is one of ${city}'s main airports and may have more than one terminal. Check the arrival terminal on their booking or in the airline's app before you set off, and put it in your Greet.`;
  if (a.size === "M")
    return `${a.name} is a regional airport, usually with a single arrivals area. When a couple of flights land together it fills up fast, so agree one exact spot to wait.`;
  return `${a.name} is a small airport with a small arrivals area. Finding each other is usually easy, but phone signal and Wi-Fi can be patchy, so agree the spot before they fly.`;
};
const airportFaq = (a, city) => [
  [
    `Which terminal will they arrive at in ${city}?`,
    a.terminals?.length > 1
      ? `${a.name} has ${a.terminals.length} arrival terminals: ${listJoin(a.terminals)}. The terminal is on their booking or in the airline's app.`
      : a.terminals?.length === 1
        ? `${a.name} has one terminal, so everyone comes out into the same arrivals area.`
        : `Check the arrival terminal on their booking or in the airline's app. Smaller airports like ${a.iata} usually have one arrivals area.`,
  ],
  [
    `How long after landing do passengers come out at ${a.iata}?`,
    `Usually 20 to 45 minutes, longer with checked bags or passport control. ${SCHENGEN.has(a.country) ? "Flights from inside Schengen are the quickest." : ""} With a Greet they tap I've landed and Collecting my bags, so you know instead of guessing.`.replace("  ", " "),
  ],
  [`What time is it at ${a.iata} right now?`, `${city} runs on ${a.tz.replace(/_/g, " ")} time. The live local time is shown at the top of this page.`],
  [`Can my guest use Arigreet at ${a.iata} without the app?`, "Yes. They open your link in their phone's browser. Airport Wi-Fi is enough."],
];

const OG = {};
for (const a of AIRPORTS) {
  const url = `/airports/${a.slug}/`;
  const city = cityOf(a);
  const place = placeOf(a);
  const countryUrl = `/airports/${a.countrySlug}/`;
  const trail = [["Home", "/"], ["Airports", "/airports/"], [a.countryName, countryUrl], [`${place} (${a.iata})`, url]];
  const near = nearby(a);
  const welcome = WELCOME[a.country];
  const faq = airportFaq(a, city);
  const termFact = a.terminals ? listJoin(a.terminals) : SIZE[a.size];
  const blocks = [
    { h: "Which terminal", p: [sizeText(a, city)] },
    {
      h: "Where to wait",
      list:
        a.size === "S"
          ? ["Just outside the arrivals door. At a small airport everyone comes out the same way.", "If you're driving, check where you're allowed to stop: small airports often have only a few short-stay spaces."]
          : [
              a.terminals?.length > 1 ? "In the arrivals hall of their terminal, a few metres back from the doors." : "Inside the arrivals hall, a few metres back from the doors passengers come through.",
              "At one landmark you can both name: a numbered exit, a café sign or the information desk.",
              "Not right at the barrier, where everyone crowds and nobody can see past the first row.",
            ],
      p: [`Put the exact spot in your Greet. Your guest sees it on their phone from the moment they land at ${a.iata}, even without signal.`],
    },
    { h: "Passport control and timing", p: [borderText(a), `${city} runs on ${a.tz.replace(/_/g, " ")} time. The clock at the top of this page shows the local time now.`] },
  ];
  if (welcome)
    blocks.push({
      h: "A local welcome",
      p: [`Want the sign to feel local? "${welcome[0]}" means welcome in ${welcome[1]}. Put it in the line above their name.`],
    });
  if (near.length)
    blocks.push({
      h: "Other airports nearby",
      p: [
        `If they could be flying into a different airport, check which one first. Within 250 km of ${a.iata}: ${near
          .slice(0, 5)
          .map(({ b, d }) => `${placeOf(b)} ${b.iata} (${Math.round(d)} km)`)
          .join(", ")}.`,
      ],
    });
  const links = [a.website && `<a href="${esc(a.website)}" rel="nofollow noopener" target="_blank">Official ${esc(a.iata)} website</a>`, a.wikipedia && `<a href="${esc(a.wikipedia)}" rel="noopener" target="_blank">${esc(a.name)} on Wikipedia</a>`].filter(Boolean);
  const html =
    head({
      title: `Meet Someone at ${place} Airport (${a.iata}) · Arrivals Guide and Greeting Board`,
      description: `Picking someone up at ${a.name}? ${a.terminals?.length > 1 ? `Arrival terminals (${listJoin(a.terminals)}), ` : ""}passport control, local time, where to wait and a free greeting board for ${a.iata} Arrivals.`,
      url,
      noindex: !indexable(a),
      image: `/og/${a.slug}.png`,
      jsonld: [
        crumbLd(trail),
        faqLd(faq),
        {
          "@context": "https://schema.org",
          "@type": "Airport",
          name: a.name,
          iataCode: a.iata,
          ...(a.icao ? { icaoCode: a.icao } : {}),
          address: { "@type": "PostalAddress", addressLocality: a.municipality || city, addressRegion: a.region || undefined, addressCountry: a.country },
          geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lon },
          ...(a.website ? { url: a.website } : {}),
          ...(a.wikipedia ? { sameAs: [a.wikipedia] } : {}),
        },
      ],
    }) +
    nav() +
    `<main id="top">
  <section class="page-hero">
    <div class="wrap">
      ${crumbs(trail.map(([l, h], i) => [l, i === trail.length - 1 ? "" : h]))}
      <span class="eyebrow">Arrivals guide · ${esc(SIZE[a.size])}</span>
      <h1 class="serif">Meeting someone at ${esc(place)} Airport.</h1>
      <p class="lede">${esc(a.name)} (${a.iata}${a.icao ? " · " + esc(a.icao) : ""})${a.region && a.region !== city ? ", " + esc(a.region) : ""}, ${esc(a.countryName)}. Which terminal, how long they'll take to come out, and a greeting board ready for the arrivals hall.</p>
      <div class="facts">
        <div class="fact"><small>Airport code</small><b>${a.iata}</b></div>
        <div class="fact"><small>${a.terminals?.length > 1 ? "Arrival terminals" : a.terminals ? "Terminal" : "Size"}</small><b>${esc(termFact)}</b></div>
        <div class="fact"><small>Local time</small><b class="clock" data-tz="${esc(a.tz)}">${esc(a.tz.replace(/_/g, " "))}</b></div>
        <div class="fact"><small>Border</small><b>${SCHENGEN.has(a.country) ? "Schengen area" : a.country === "GB" ? "UK Border Force" : a.country === "US" ? "US CBP" : "Passport control for international"}</b></div>
      </div>
    </div>
  </section>
  ${gen({ title: `Greeting board for ${place} Airport`, text: `Make a sign for ${a.iata} Arrivals. Show it full screen, save it, or create a Greet so they can find you.`, top: `Welcome to ${city}`, airport: a.iata })}
  <section class="prose">
    <div class="wrap prose-grid">
      <aside><span class="eyebrow">${a.iata} at a glance</span><ul class="toc">${blocks
        .map((b) => `<li><a href="#${b.h.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${esc(b.h)}</a></li>`)
        .join("")}<li><a href="#faq">Questions</a></li></ul>${links.length ? `<p class="aside-links">${links.join("<br>")}</p>` : ""}</aside>
      <div>${blocks.map(blockHtml).join("\n")}</div>
    </div>
  </section>
  <section class="faq" id="faq">
    <div class="wrap faq-grid">
      <div><h2 class="serif">Frequently asked questions</h2><p class="faq-lede">Everything you need to know before getting started.</p></div>
      <div>${faqHtml(faq)}</div>
    </div>
  </section>
  <section class="links-sec">
    <div class="wrap">
      <h2 class="serif">${near.length ? "Airports near " + esc(city) : "More in " + esc(a.countryName)}</h2>
      <div class="link-grid">${(near.length ? near.map((x) => x.b) : AIRPORTS.filter((b) => b.country === a.country && b.iata !== a.iata).slice(0, 8))
        .map((b) => `<a class="link-card" href="/airports/${b.slug}/"><b>${esc(placeOf(b))} (${b.iata})</b><span>${esc(b.name)}</span></a>`)
        .join("")}<a class="link-card" href="${countryUrl}"><b>All airports in ${esc(a.countryName)}</b><span>Arrival guides and greeting boards</span></a></div>
    </div>
  </section>
  ${sendoff(`See you at ${city} Arrivals.`)}
</main>` +
    tail();
  OG[a.slug] = { kicker: `Arrivals guide · ${a.countryName}`, place, city, code: a.iata };
  write(url, html, a.size === "L" ? 0.8 : a.size === "M" ? 0.6 : 0.5, indexable(a) ? "airports" : null);
}

writeFileSync(path.join(out, "og-data.json"), JSON.stringify(OG));

// Country pages: /airports/<country>/
const byCountry = new Map();
for (const a of AIRPORTS) byCountry.set(a.country, [...(byCountry.get(a.country) || []), a]);
const sortAirports = (as) => [...as].sort((x, y) => SIZE_ORDER[x.size] - SIZE_ORDER[y.size] || cityOf(x).localeCompare(cityOf(y)));
for (const [code, as] of byCountry) {
  const c = as[0];
  const url = `/airports/${c.countrySlug}/`;
  const sorted = sortAirports(as);
  const major = sorted.filter((a) => a.size === "L");
  const trail = [["Home", "/"], ["Airports", "/airports/"], [c.countryName, url]];
  write(
    url,
    head({
      title: `Airports in ${c.countryName} · Where to Meet Someone at Arrivals`,
      description: `Arrival guides for ${as.length} airport${as.length > 1 ? "s" : ""} in ${c.countryName} with scheduled flights${major.length ? `, including ${listJoin(major.slice(0, 3).map(cityOf))}` : ""}. Terminals, passport control, local time and a free greeting board.`,
      url,
      jsonld: [crumbLd(trail)],
    }) +
      nav() +
      `<main id="top"><section class="page-hero"><div class="wrap">${crumbs(trail.map(([l, h], i) => [l, i === trail.length - 1 ? "" : h]))}<span class="eyebrow">${esc(CONTINENTS[c.continent] || "")}</span><h1 class="serif">Meeting someone at an airport in ${esc(c.countryName)}.</h1><p class="lede">${as.length} airport${as.length > 1 ? "s" : ""} with scheduled flights${major.length ? `. The busiest are ${esc(listJoin(major.slice(0, 4).map((a) => `${cityOf(a)} (${a.iata})`)))}` : ""}. ${esc(borderText(c).split(". ")[0])}.</p></div></section>
      ${gen({ title: `Greeting board for ${c.countryName}`, top: WELCOME[code]?.[0] || "Welcome" })}
      <section class="links-sec"><div class="wrap">${["L", "M", "S"]
        .map((s) => [s, sorted.filter((a) => a.size === s)])
        .filter(([, l]) => l.length)
        .map(
          ([s, l]) =>
            `<div class="country"><h3>${SIZE[s]}s</h3><div class="link-grid">${l
              .map((a) => `<a class="link-card" href="/airports/${a.slug}/"><b>${esc(placeOf(a))} (${a.iata})</b><span>${esc(a.name)}</span></a>`)
              .join("")}</div></div>`,
        )
        .join("")}</div></section>${sendoff()}</main>` +
      tail(),
    major.length ? 0.7 : 0.5,
    "airports",
  );
}

// Airports index: continents, countries, busiest airports
{
  const conts = new Map();
  for (const [code, as] of byCountry) {
    const k = as[0].continent;
    conts.set(k, [...(conts.get(k) || []), as]);
  }
  const busiest = AIRPORTS.filter((a) => POPULAR.includes(a.iata));
  write(
    "/airports/",
    head({
      title: "Airport Arrivals Guides · Where to Meet Someone at Any Airport",
      description: `Arrival guides for ${AIRPORTS.length.toLocaleString("en-US")} airports with scheduled flights in ${byCountry.size} countries: terminals, passport control, local time and a free greeting board.`,
      url: "/airports/",
    }) +
      nav() +
      `<main id="top"><section class="page-hero"><div class="wrap">${crumbs([["Home", "/"], ["Airports", ""]])}<span class="eyebrow">Arrivals guides</span><h1 class="serif">Where to meet at ${AIRPORTS.length.toLocaleString("en-US")} airports.</h1><p class="lede">Every airport with scheduled flights, in ${byCountry.size} countries. Terminals, passport control, local time and a greeting board for each.</p></div></section>
      ${gen({})}
      <section class="links-sec"><div class="wrap"><h2 class="serif">Busiest arrivals</h2><div class="link-grid">${busiest
        .map((a) => `<a class="link-card" href="/airports/${a.slug}/"><b>${esc(placeOf(a))} (${a.iata})</b><span>${esc(a.countryName)}</span></a>`)
        .join("")}</div>
      ${["EU", "NA", "AS", "AF", "SA", "OC"]
        .filter((k) => conts.has(k))
        .map(
          (k) =>
            `<div class="country"><h3>${CONTINENTS[k]}</h3><div class="link-grid">${conts
              .get(k)
              .sort((x, y) => x[0].countryName.localeCompare(y[0].countryName))
              .map((as) => `<a class="link-card" href="/airports/${as[0].countrySlug}/"><b>${esc(as[0].countryName)}</b><span>${as.length} airport${as.length > 1 ? "s" : ""}</span></a>`)
              .join("")}</div></div>`,
        )
        .join("")}</div></section>${sendoff()}</main>` +
      tail(),
    0.9,
  );
}

// Sitemaps: one per section, plus an index
const today = new Date().toISOString().slice(0, 10);
const maps = [...new Set(pages.map((p) => p.map).filter(Boolean))];
for (const m of maps)
  writeFileSync(
    path.join(out, `sitemap-${m}.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
      .filter((p) => p.map === m)
      .map((p) => `  <url><loc>${SITE}${p.url}</loc><lastmod>${today}</lastmod><priority>${p.priority.toFixed(1)}</priority></url>`)
      .join("\n")}\n</urlset>\n`,
  );
writeFileSync(
  path.join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps
    .map((m) => `  <sitemap><loc>${SITE}/sitemap-${m}.xml</loc><lastmod>${today}</lastmod></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`,
);
writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /g/\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`arigreet.com: ${pages.length} pages written to website/dist, ${pages.filter((p) => p.map).length} in the sitemap`);
if (!existsSync(path.join(out, "index.html"))) process.exit(1);
