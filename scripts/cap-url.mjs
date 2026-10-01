// Tells the Android/iPhone app which Arigreet server to talk to.
// Run before `npm run build` for an app build:
//   ARIGREET_URL=https://arigreet.com node scripts/cap-url.mjs
// The app's screens are built into the phone; only data goes to this address.
import { writeFileSync } from "node:fs";
const url = (process.env.ARIGREET_URL || "").replace(/\/$/, "");
if (!url) {
  console.log("ARIGREET_URL not set; the app will use https://arigreet.onrender.com");
  process.exit(0);
}
if (!/^https:\/\/[^/]+$/.test(url)) throw Error("ARIGREET_URL must look like https://arigreet.com");
writeFileSync(".env.production.local", `VITE_API_URL=${url}\n`);
console.log("Arigreet app will talk to", url);
