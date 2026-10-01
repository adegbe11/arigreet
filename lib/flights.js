export function localDate(iso, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
export function selectFlight(flights, greet) {
  const code =
    greet.airportCode?.toUpperCase() ||
    greet.airport?.match(/\(([A-Z]{3,4})\)/)?.[1];
  if (!code || !greet.date) return null;
  const candidates = flights.filter((f) => {
    const airport = f.destination;
    const codes =
      typeof airport === "object"
        ? [airport?.code_iata, airport?.code_icao, airport?.code]
        : [airport, f.destination_iata, f.destination_icao];
    const scheduled = f.scheduled_in || f.scheduled_on;
    if (!codes.includes(code) || !scheduled) return false;
    try {
      return (
        localDate(
          scheduled,
          airport?.timezone || greet.airportTimezone || "UTC",
        ) === greet.date
      );
    } catch {
      return false;
    }
  });
  const bound = greet.flightData?.flightId;
  if (bound) return candidates.find((f) => f.fa_flight_id === bound) || null;
  // Multiple legs/instances must not silently bind to the wrong flight.
  return candidates.length === 1 ? candidates[0] : null;
}
export function flightUpdate(
  greet,
  flight,
  { now = Date.now(), thresholdMinutes = 20 } = {},
) {
  const previous = greet.flightData;
  const iso = (v) => (v && Number.isFinite(Date.parse(v)) ? v : null);
  const scheduled = iso(flight.scheduled_in || flight.scheduled_on);
  const estimated = iso(flight.estimated_in || flight.estimated_on);
  const actual = iso(flight.actual_on || flight.actual_in);
  const status = flight.cancelled
    ? "CANCELLED"
    : flight.diverted
      ? "DIVERTED"
      : actual
        ? "LANDED"
        : iso(flight.actual_off)
          ? "FLIGHT_IN_PROGRESS"
          : "SCHEDULED";
  const data = {
    provider: "FlightAware",
    flightId: flight.fa_flight_id,
    scheduled,
    estimated,
    actual,
    status,
    terminal: flight.terminal_destination || null,
    gate: flight.gate_destination || null,
    baggage: flight.baggage_claim || null,
    timezone: flight.destination?.timezone || greet.airportTimezone || "UTC",
    updatedAt: now,
  };
  let notification = null;
  const baseline =
    previous?.notifiedEstimate || previous?.estimated || scheduled;
  if (
    estimated &&
    !actual &&
    !["CANCELLED", "DIVERTED"].includes(status) &&
    baseline &&
    Math.abs(Date.parse(estimated) - Date.parse(baseline)) >=
      thresholdMinutes * 60000
  ) {
    notification = {
      type: "ETA",
      minutes: Math.round(
        (Date.parse(estimated) - Date.parse(baseline)) / 60000,
      ),
    };
  }
  if (
    ["LANDED", "CANCELLED", "DIVERTED"].includes(status) &&
    previous?.status !== status
  )
    notification = { type: status };
  data.notifiedEstimate =
    notification?.type === "ETA"
      ? estimated
      : previous?.notifiedEstimate || scheduled;
  greet.flightData = data;
  delete greet.flightError;
  // Flight facts never regress the pickup after baggage/readiness/location has begun.
  if (
    [
      "CREATED",
      "INVITATION_SENT",
      "INVITATION_OPENED",
      "PASSENGER_CONFIRMED",
      "PRE_ARRIVAL",
      "FLIGHT_IN_PROGRESS",
      "LANDED",
    ].includes(greet.state)
  ) {
    if (status === "LANDED") greet.state = "LANDED";
    else if (status === "FLIGHT_IN_PROGRESS" && greet.state !== "LANDED")
      greet.state = "FLIGHT_IN_PROGRESS";
  }
  return notification;
}
export async function fetchFlight(
  greet,
  { apiKey = process.env.FLIGHTAWARE_API_KEY, fetcher = fetch } = {},
) {
  if (!apiKey) throw Error("Flight updates are not configured.");
  const ident = String(greet.flight || "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(ident))
    throw Error("Enter a valid flight identifier.");
  const date = Date.parse(greet.date + "T00:00:00Z");
  if (!Number.isFinite(date)) throw Error("Enter a valid arrival date.");
  const query = new URLSearchParams({
    start: new Date(date - 86400000).toISOString(),
    end: new Date(date + 2 * 86400000).toISOString(),
    max_pages: "1",
  });
  const res = await fetcher(
    "https://aeroapi.flightaware.com/aeroapi/flights/" +
      encodeURIComponent(ident) +
      "?" +
      query,
    {
      headers: { "x-apikey": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok)
    throw Error(
      res.status === 429
        ? "Flight provider rate limit reached."
        : "Flight provider temporarily unavailable.",
    );
  const data = await res.json();
  const selected = selectFlight(data.flights || [], greet);
  if (!selected)
    throw Error(
      "No unique flight found for this airport and arrival date. Your manual details are still available.",
    );
  return selected;
}
