/* The greeter's Greets, saved on the phone so the GreetBoard and the pickup
   details still open at the airport with no signal. One copy per signed-in
   user, removed on sign-out. Live locations and chat are never saved. */
const KEY = "arigreet-greeter:";
const ENDED = ["COMPLETED", "CANCELLED", "EXPIRED"];
const SKIP = new Set(["locations", "messages", "confirmations"]);
const BIG = 200000; // leave out very large photos so the copy always fits

const slim = (g) => ({
  ...Object.fromEntries(
    Object.entries(g).filter(([k, v]) => !SKIP.has(k) && !(typeof v === "string" && v.length > BIG)),
  ),
  ...("locations" in g ? { locations: {} } : {}),
  ...("messages" in g ? { messages: [] } : {}),
  ...("confirmations" in g ? { confirmations: [] } : {}),
});

export function saveGreeter(storage, userId, greets, profile, now = Date.now()) {
  if (!userId) return;
  const keep = (greets || []).filter((g) => !ENDED.includes(g.state)).map(slim);
  const data = JSON.stringify({ at: now, greets: keep, profile: profile ? slim(profile) : null });
  try {
    storage.setItem(KEY + userId, data);
  } catch {
    // Storage full: save without any photos.
    try {
      const bare = keep.map((g) => Object.fromEntries(Object.entries(g).filter(([, v]) => !(typeof v === "string" && v.startsWith("data:")))));
      storage.setItem(KEY + userId, JSON.stringify({ at: now, greets: bare, profile: null }));
    } catch {}
  }
}

export function readGreeter(storage, userId) {
  if (!userId) return null;
  try {
    const v = JSON.parse(storage.getItem(KEY + userId) || "null");
    return v && Array.isArray(v.greets) ? v : null;
  } catch {
    return null;
  }
}

export function clearGreeter(storage) {
  try {
    Object.keys(storage)
      .filter((k) => k.startsWith(KEY))
      .forEach((k) => storage.removeItem(k));
  } catch {}
}
