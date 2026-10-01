const prefix = "arigreet-pickup:";
const fields = [
  "id",
  "name",
  "greeter",
  "greeterPhoto",
  "vehicle",
  "colour",
  "plate",
  "vehiclePhoto",
  "airport",
  "terminal",
  "area",
  "exit",
  "landmark",
  "instructions",
  "contact",
  "allowCall",
  "flight",
  "date",
  "time",
  "beacon",
  "theme",
  "boardName",
  "passengers",
  "bags",
  "childSeat",
  "assistance",
  "notes",
  "expires",
];
export function savePickup(storage, token, greet, now = Date.now()) {
  if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(greet.state))
    return clearPickup(storage, token);
  const pickup = Object.fromEntries(fields.map((k) => [k, greet[k]]));
  const previous = readPickup(storage, token, now);
  const sources = {
    greeterPhoto: greet.greeterPhoto,
    vehiclePhoto: greet.vehiclePhoto,
  };
  for (const k of Object.keys(sources))
    if (
      previous?.sources?.[k] === sources[k] &&
      previous?.pickup?.[k]?.startsWith("data:image/")
    )
      pickup[k] = previous.pickup[k];
  const entry = {
    pickup,
    sources,
    cachedAt: now,
    expires: Math.min(greet.expires || now + 86400000, now + 86400000),
  };
  storage.setItem(prefix + token, JSON.stringify(entry));
  return entry;
}
export function readPickup(storage, token, now = Date.now()) {
  try {
    const entry = JSON.parse(storage.getItem(prefix + token) || "null");
    if (!entry || entry.expires <= now) {
      clearPickup(storage, token);
      return null;
    }
    return entry;
  } catch {
    clearPickup(storage, token);
    return null;
  }
}
export function clearPickup(storage, token) {
  storage.removeItem(prefix + token);
}
const loading = new Map();
async function imageData(url) {
  if (url.startsWith("data:image/")) return url;
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Photo unavailable.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > 5 * 1024 * 1024)
    throw Error("Photo cannot be cached.");
  const objectURL = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectURL;
    await image.decode();
    const scale = Math.min(
      1,
      640 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}
export async function cachePickupPhotos(storage, token, loader = imageData) {
  if (loading.has(token)) return loading.get(token);
  const promise = (async () => {
    const entry = readPickup(storage, token);
    if (!entry) return;
    await Promise.allSettled(
      Object.entries(entry.sources || {}).map(async ([field, url]) => {
        if (!url || entry.pickup[field]?.startsWith("data:image/")) return;
        const data = await loader(url);
        const latest = readPickup(storage, token);
        if (!latest || latest.sources?.[field] !== url) return;
        latest.pickup[field] = data;
        storage.setItem(prefix + token, JSON.stringify(latest));
      }),
    );
  })();
  loading.set(token, promise);
  try {
    await promise;
  } finally {
    loading.delete(token);
  }
}
