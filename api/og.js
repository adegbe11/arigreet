// Vercel function: share images for airport pages (/og/<slug>.png is rewritten here).
import { readFileSync } from "node:fs";
import path from "node:path";
import { ogPng } from "../lib/og.js";

let data = null;

export default function handler(req, res) {
  data ||= JSON.parse(readFileSync(path.join(process.cwd(), "website/dist/og-data.json"), "utf8"));
  const d = data[String(req.query.slug || "")];
  if (!d) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800");
  res.end(ogPng(d));
}
