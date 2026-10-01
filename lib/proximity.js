export const liveStates = [
  "PASSENGER_READY",
  "LIVE_GREET",
  "NEARBY",
  "VERY_CLOSE",
];
export function proximity(
  g,
  { nearbyMetres = 30, closeMetres = 10, now = Date.now() } = {},
) {
  if (!liveStates.includes(g.state)) return;
  // An explicit report of the configured meeting point is stronger indoors than GPS.
  const reported = (report) => report?.atPoint && now - report.at < 10 * 60000;
  const guestAtPoint = reported(g.meetingIntent),
    greeterAtPoint = reported(g.greeterIntent);
  if (guestAtPoint && greeterAtPoint) {
    g.state = "VERY_CLOSE";
    return;
  }
  const a = g.locations.guest,
    b = g.locations.greeter;
  if (!a || !b) {
    if (guestAtPoint) g.state = "NEARBY";
    else if (["NEARBY", "VERY_CLOSE"].includes(g.state)) g.state = "LIVE_GREET";
    return;
  }
  if (
    a.accuracy > 30 ||
    b.accuracy > 30 ||
    now - a.timestamp > 30000 ||
    now - b.timestamp > 30000
  ) {
    g.state = guestAtPoint ? "NEARBY" : "LIVE_GREET";
    return;
  }
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  const d = 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  // Even overlapping coordinates never establish VERY_CLOSE or a meeting.
  // Spec §41: very close at ~5–10 m, only where accuracy supports it —
  // the distance plus the worse accuracy radius must still be under the threshold.
  g.state =
    d + Math.max(a.accuracy, b.accuracy) < closeMetres
      ? "VERY_CLOSE"
      : guestAtPoint || d < nearbyMetres
        ? "NEARBY"
        : "LIVE_GREET";
}
