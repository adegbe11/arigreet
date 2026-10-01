import test from "node:test";
import assert from "node:assert/strict";
import {
  savePickup,
  readPickup,
  cachePickupPhotos,
  clearPickup,
} from "../src/guest-cache.js";
import { proximity } from "../lib/proximity.js";
import { selectFlight, flightUpdate, fetchFlight } from "../lib/flights.js";
const now = Date.parse("2026-09-30T12:00:00Z");
const storage = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
test("offline pickup persists essentials without messages or live GPS; expiry and cancellation remove it", () => {
  const local = storage(),
    g = {
      state: "LIVE_GREET",
      name: "Sarah",
      greeterPhoto: "https://example.test/photo.jpg",
      vehicle: "V-Class",
      area: "Arrivals Hall",
      exit: "Exit 3",
      expires: now + 86400000,
      locations: { guest: { latitude: 10 } },
      messages: [{ text: "private" }],
      token: "secret",
    };
  savePickup(local, "token", g, now);
  const saved = readPickup(local, "token", now + 60000);
  assert.equal(saved.pickup.exit, "Exit 3");
  assert.equal(saved.pickup.greeterPhoto, g.greeterPhoto);
  assert.equal(saved.pickup.locations, undefined);
  assert.equal(saved.pickup.messages, undefined);
  assert.equal(saved.pickup.token, undefined);
  assert.equal(readPickup(local, "token", now + 86400000), null);
  savePickup(local, "token", g, now);
  savePickup(local, "token", { ...g, state: "CANCELLED" }, now);
  assert.equal(readPickup(local, "token", now), null);
});
test("photo thumbnails survive later status updates and asynchronous caching cannot resurrect a removed pickup", async () => {
  const local = storage(),
    g = {
      state: "CREATED",
      greeterPhoto: "https://example.test/photo.jpg",
      expires: Date.now() + 86400000,
    };
  savePickup(local, "photo-token", g);
  await cachePickupPhotos(
    local,
    "photo-token",
    async () => "data:image/jpeg;base64,test-thumbnail",
  );
  savePickup(local, "photo-token", { ...g, state: "INVITATION_OPENED" });
  assert.equal(
    readPickup(local, "photo-token").pickup.greeterPhoto,
    "data:image/jpeg;base64,test-thumbnail",
  );
  savePickup(local, "pending-token", g);
  let finish;
  const pending = cachePickupPhotos(
    local,
    "pending-token",
    () => new Promise((resolve) => (finish = resolve)),
  );
  clearPickup(local, "pending-token");
  finish("data:image/jpeg;base64,discarded");
  await pending;
  assert.equal(readPickup(local, "pending-token"), null);
});
test("VERY_CLOSE needs accuracy that supports it; intent and joint point reports also work", () => {
  const g = {
    state: "LIVE_GREET",
    locations: {
      guest: { latitude: 37, longitude: 23, accuracy: 12, timestamp: now },
      greeter: { latitude: 37, longitude: 23, accuracy: 8, timestamp: now },
    },
  };
  // Overlapping, but a 12 m accuracy radius cannot prove they are within 10 m.
  proximity(g, { now });
  assert.equal(g.state, "NEARBY");
  g.locations.guest.accuracy = 4;
  proximity(g, { now });
  assert.equal(g.state, "VERY_CLOSE");
  g.locations.guest.accuracy = 100;
  proximity(g, { now });
  assert.equal(g.state, "LIVE_GREET");
  g.meetingIntent = { atPoint: true, at: now };
  proximity(g, { now });
  assert.equal(g.state, "NEARBY");
  g.greeterIntent = { atPoint: true, at: now };
  proximity(g, { now });
  assert.equal(g.state, "VERY_CLOSE");
  proximity(g, { now: now + 11 * 60000 });
  assert.equal(g.state, "LIVE_GREET");
  g.state = "MEETING_CONFIRMATION";
  proximity(g, { now });
  assert.equal(g.state, "MEETING_CONFIRMATION");
});
const flight = {
  fa_flight_id: "AEE123-unique",
  destination: { code_iata: "ATH", timezone: "Europe/Athens" },
  scheduled_in: "2026-09-30T11:20:00Z",
  estimated_in: "2026-09-30T13:20:00Z",
  actual_off: "2026-09-30T10:00:00Z",
};
test("flight selection binds airport, local scheduled date and unique instance", () => {
  const g = { airport: "Athens (ATH)", date: "2026-09-30" };
  assert.equal(selectFlight([flight], g), flight);
  assert.equal(
    selectFlight([{ ...flight, destination: { code_iata: "LHR" } }], g),
    null,
  );
  assert.equal(
    selectFlight([flight, { ...flight, fa_flight_id: "other" }], g),
    null,
  );
  const midnight = { ...flight, scheduled_in: "2026-09-29T22:30:00Z" };
  assert.equal(selectFlight([midnight], g), midnight);
});
test("flight shifts notify once per significant change; landing never regresses readiness", () => {
  const g = { state: "INVITATION_OPENED", time: "14:20" };
  const first = flightUpdate(g, flight, { now });
  assert.deepEqual(first, { type: "ETA", minutes: 120 });
  assert.equal(g.state, "FLIGHT_IN_PROGRESS");
  assert.equal(g.time, "14:20");
  assert.equal(flightUpdate(g, flight, { now }), null);
  assert.equal(
    flightUpdate(
      g,
      { ...flight, estimated_in: "2026-09-30T10:35:00Z" },
      { now },
    ).minutes,
    -165,
  );
  g.state = "PASSENGER_READY";
  assert.equal(
    flightUpdate(g, { ...flight, actual_on: "2026-09-30T10:30:00Z" }, { now })
      .type,
    "LANDED",
  );
  assert.equal(g.state, "PASSENGER_READY");
  assert.equal(
    flightUpdate(g, { ...flight, actual_on: "2026-09-30T10:30:00Z" }, { now }),
    null,
  );
});
test("provider adapter uses server key, normalizes flight identifier, and rejects outages", async () => {
  const g = { flight: "A3 123", airport: "Athens (ATH)", date: "2026-09-30" };
  const selected = await fetchFlight(g, {
    apiKey: "test-key",
    fetcher: async (url, options) => {
      assert.match(url, /\/flights\/A3123\?/);
      assert.equal(options.headers["x-apikey"], "test-key");
      return { ok: true, json: async () => ({ flights: [flight] }) };
    },
  });
  assert.equal(selected.fa_flight_id, flight.fa_flight_id);
  await assert.rejects(
    fetchFlight(g, {
      apiKey: "test-key",
      fetcher: async () => ({ ok: false, status: 429 }),
    }),
    /rate limit/,
  );
});
