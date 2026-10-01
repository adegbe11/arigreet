import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://localhost:3001";
test("secure invitation, live updates, and mutual completion", async () => {
  const request = async (url, body, token, guest) => {
    const r = await fetch(base + "/api" + url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(guest ? { "X-Guest-Token": guest } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const a = await request("/auth/register", {
    name: "Lifecycle test",
    email: `test-${Date.now()}@example.test`,
    password: "secure-test-password",
  });
  assert.equal(a.status, 200);
  const token = a.data.token;
  const created = await request(
    "/greets",
    { name: "Test Guest", greeter: "Test Greeter" },
    token,
  );
  assert.equal(created.status, 200);
  const g = created.data;
  assert.equal(
    (
      await request("/greets/" + g.id + "/action", {
        action: "state",
        value: "LANDED",
      })
    ).status,
    403,
  );
  assert.equal((await request("/guest/not-a-token")).status, 404);
  assert.equal(
    (await request("/guest/" + g.token)).data.state,
    "INVITATION_OPENED",
  );
  const controller = new AbortController();
  const stream = await fetch(
    base + "/api/greets/" + g.id + "/events?token=" + g.token,
    { signal: controller.signal },
  );
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /INVITATION_OPENED/);
  await reader.cancel();
  controller.abort();
  const act = (action, value, guest = false) =>
    request(
      "/greets/" + g.id + "/action",
      { action, value },
      guest ? null : token,
      guest ? g.token : null,
    );
  assert.equal((await act("state", "COMPLETED", true)).status, 409);
  assert.equal((await act("confirm", null, true)).status, 409);
  assert.equal((await act("state", "CANCELLED", true)).status, 403);
  assert.equal(
    (await act("edit", { name: "Updated Test Guest", token: "injected-token" }))
      .data.token,
    g.token,
  );
  assert.equal(
    (await act("state", "PASSENGER_READY", true)).data.state,
    "PASSENGER_READY",
  );
  assert.equal(
    (
      await act(
        "location",
        { latitude: 37.936, longitude: 23.945, accuracy: 10 },
        true,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await act("location", {
        latitude: 37.9365,
        longitude: 23.945,
        accuracy: 10,
      })
    ).data.state,
    "LIVE_GREET",
  );
  assert.equal((await act("state", "VERY_CLOSE", true)).status, 409);
  assert.equal(
    (await act("meeting-point", { atPoint: true }, true)).data.state,
    "NEARBY",
  );
  assert.equal(
    (await act("meeting-point", { atPoint: true })).data.state,
    "VERY_CLOSE",
  );
  assert.equal(
    (await act("meeting-point", { atPoint: false }, true)).data.state,
    "LIVE_GREET",
  );
  // There is no chat: the passenger talks to the greeter with status buttons only.
  assert.equal((await act("message", "hello", true)).status, 400);
  assert.equal((await act("flash", null, true)).status, 200);
  assert.equal((await act("flash", null, true)).status, 429);
  assert.equal(
    (await act("confirm", null, true)).data.state,
    "MEETING_CONFIRMATION",
  );
  const completed = (await act("confirm")).data;
  assert.equal(completed.state, "COMPLETED");
  assert.deepEqual(completed.locations, {});
  assert.equal(
    (await act("location", { latitude: 37, longitude: 23, accuracy: 5 }, true))
      .status,
    409,
  );
});
test("greets only accept greeter fields, hide the owner, and take one-tap status updates", async () => {
  const request = async (url, body, token, guest) => {
    const r = await fetch(base + "/api" + url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(guest ? { "X-Guest-Token": guest } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const a = await request("/auth/register", {
    name: "Audit test",
    email: `audit-${Date.now()}@example.test`,
    password: "secure-test-password",
  });
  const token = a.data.token;
  const created = await request(
    "/greets",
    {
      name: "Guest",
      state: "COMPLETED",
      identification: { wearing: "fake" },
      rating: 5,
      companyLogo: "javascript:alert(1)",
      photo: "http://tracker.example/pixel.png",
    },
    token,
  );
  assert.equal(created.status, 200);
  const g = created.data;
  assert.equal(g.state, "CREATED");
  assert.equal(g.identification, undefined);
  assert.equal(g.rating, undefined);
  assert.equal(g.companyLogo, "");
  assert.equal(g.photo, "");
  assert.equal(g.greeter, "Audit test");
  const guest = await request("/guest/" + g.token);
  assert.equal(guest.data.owner, undefined);
  // "I've landed" is a one-tap status the greeter sees straight away.
  const landed = await request(`/greets/${g.id}/action`, { action: "state", value: "LANDED" }, null, g.token);
  assert.equal(landed.status, 200);
  assert.equal(landed.data.state, "LANDED");
  const bags = await request(`/greets/${g.id}/action`, { action: "state", value: "BAGGAGE_COLLECTION" }, null, g.token);
  assert.equal(bags.data.state, "BAGGAGE_COLLECTION");
});
test("greeter status, 'I can't find you', and a link preview that names the greeter", async () => {
  const request = async (url, body, token, guest) => {
    const r = await fetch(base + "/api" + url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(guest ? { "X-Guest-Token": guest } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const a = await request("/auth/register", {
    name: "Status test",
    email: `status-${Date.now()}@example.test`,
    password: "secure-test-password",
  });
  const token = a.data.token;
  const g = (await request("/greets", { name: "Helen Johnson", greeter: "Michael Collins", airport: "Athens (ATH)" }, token)).data;
  const act = (body, asGuest) => request(`/greets/${g.id}/action`, body, asGuest ? null : token, asGuest ? g.token : null);
  // Only the greeter can post where they are; the passenger sees it.
  assert.equal((await act({ action: "presence", value: "LATE_20" }, true)).status, 403);
  assert.equal((await act({ action: "presence", value: "TELEPORTED" })).status, 400);
  assert.equal((await act({ action: "presence", value: "AT_ARRIVALS" })).status, 200);
  const seen = (await request("/guest/" + g.token)).data;
  assert.equal(seen.greeterStatus.code, "AT_ARRIVALS");
  assert.equal(seen.greeterIntent.atPoint, true);
  // "I can't find you" needs the passenger to have landed, then lights the board.
  assert.equal((await act({ action: "help" }, true)).status, 409);
  await act({ action: "state", value: "LANDED" }, true);
  const help = await act({ action: "help" }, true);
  assert.equal(help.status, 200);
  assert.ok(help.data.flashAt && help.data.helpAt);
  assert.equal((await act({ action: "help" }, true)).status, 429);
  assert.equal((await act({ action: "help" })).status, 403);
  // WhatsApp/iMessage preview names who is meeting them.
  const html = await (await fetch(base + "/g/" + g.token)).text();
  assert.match(html, /og:title" content="Michael Collins is meeting you at Athens Airport"/);
  assert.match(html, /noindex/);
});
test("config exposes the map provider and legal details; account deletion removes everything", async () => {
  const cfg = await (await fetch(base + "/api/config")).json();
  assert.ok(cfg.map.url.includes("{z}"));
  assert.equal(typeof cfg.legal.retentionDays, "number");
  const post = async (url, body, token) => {
    const r = await fetch(base + "/api" + url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const email = `erase-${Date.now()}@example.test`;
  const a = await post("/auth/register", { name: "Erase me", email, password: "secure-test-password" });
  const g = (await post("/greets", { name: "Guest" }, a.data.token)).data;
  assert.equal((await post("/account/delete", { password: "wrong-password!!" }, a.data.token)).status, 403);
  assert.equal((await post("/account/delete", { password: "secure-test-password" }, a.data.token)).status, 200);
  assert.equal((await fetch(base + "/api/guest/" + g.token)).status, 404);
  assert.equal((await fetch(base + "/api/me", { headers: { Authorization: "Bearer " + a.data.token } })).status, 401);
  assert.equal((await post("/auth/login", { email, password: "secure-test-password" })).status, 401);
});
