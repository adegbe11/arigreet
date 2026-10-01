# Arigreet

Responsive greeter application and account-free guest experience. React, Express, SQLite, server-sent events, browser geolocation, and OpenStreetMap.

## Run

Requires Node 24 or newer.

```sh
npm install
npm run build
npm start
```

Open http://localhost:3001. Register a greeter account, create a Greet, and open its invitation in another browser/device. Both users must confirm a meeting. For development, run the backend and `npm run dev` in separate terminals.

```sh
npm test
```

Tests require a running backend. They create isolated test accounts and verify authorization, invitation validation, state transitions, message persistence, beacon throttling, mutual confirmation, and location shutdown.

## Included

- Account registration, password hashing, expiring sessions and authentication throttling.
- Eight-stage creation flow, board design, review, QR and native/channel sharing.
- Durable SQLite Greets, messages, timeline, and account-free cryptographic invitation links.
- Realtime SSE updates; browser geolocation with accuracy, heading, speed and timestamps.
- Temporary sharing, weak/approximate signal messaging, proximity emphasis, safe board pulses and wake lock.
- Guest identification, baggage readiness, mutual meeting confirmation, cancellation, history, profile and vehicle saving.
- Responsive desktop workspace and mobile guest/greeter layouts.
- Installable PWA, cached offline shell, device-local form drafts, Web Push subscriptions and SMTP password recovery.
- Offline guest pickup snapshots (meeting point, greeter and vehicle details), per-invitation photo caching, explicit meeting-point check-ins, and a configurable FlightAware adapter.

## Airport resilience

On a successful invitation visit, essential pickup details are saved in localStorage. Greeter/vehicle photos are prefetched into a service-worker cache using local routes scoped to the invitation; CORS-accessible images are also converted to bounded JPEG thumbnails in the localStorage snapshot. Oversized or inaccessible external images may not be cached. The app shell and its JS/CSS are precached. Offline reopening shows a read-only saved pickup with its download timestamp. Messages and GPS coordinates are never stored in the offline snapshot, and live actions are not queued. Snapshots expire after 24 hours or the invitation expiry, whichever comes first. Completion, cancellation, expiry, and invalid-link responses clear the snapshot and its image cache. Guests can also remove saved details themselves. First access still needs connectivity; offline clients cannot learn about changes or revocation until they reconnect.

GPS alone can suggest NEARBY but cannot trigger VERY_CLOSE. The guest can report “I am standing at Exit 3.” VERY_CLOSE requires that report plus either a matching greeter check-in or a fresh, accurate location within the close threshold including its reported accuracy. Poor/stale GPS falls back to meeting-point instructions. Check-ins expire after ten minutes and can be withdrawn. Neither GPS nor a check-in completes a Greet; both people must confirm meeting.

Set `FLIGHTAWARE_API_KEY` in `.env` to activate [FlightAware AeroAPI](https://www.flightaware.com/commercial/aeroapi/). No API calls are made without a key. Configure the airport code and IANA time zone in the arrival form. The adapter binds the scheduled arrival date at the destination airport and a unique FlightAware flight instance; ambiguous matches remain manual. Polling defaults to every five minutes for Greets within two days of the arrival date. `FLIGHT_POLL_SECONDS` sets the interval (minimum 60 seconds), and `FLIGHT_ALERT_MINUTES` sets the significant ETA-change threshold (default 20 minutes). Provider usage may incur charges under your account's plan.

Estimated arrival updates the dashboard separately from the manually entered schedule. Significant earlier/later changes, landing, cancellation and diversion produce greeter push alerts when notifications are enabled. Repeated unchanged updates are deduplicated. Flight facts never regress baggage/readiness/live-meeting states. Provider errors preserve manual details and the last known update, clearly marked with its last-check time. The provider adapter and alert logic are tested with fixtures; live provider access requires your API key.

## Deployment status

This is an implemented mobile web application, **not a fully production-certified native mobile application**. Before a public launch, provision HTTPS and a stable public domain (required for location and share APIs on remote devices), persist/back up SQLite on a single server, and configure a supported production map tile provider. Copy `.env.example` to `.env` and configure SMTP for password recovery. Web Push keys are generated once and stored in SQLite; set a valid `VAPID_SUBJECT`. Enable notifications in Profile. Browser support and OS background-delivery restrictions apply. OAuth is not configured. FlightAware integration requires your provider key; manual flight entry always works. Browser background GPS is limited by the operating system. Universal/app links and native builds are not configured. Photo fields currently accept URLs; private media upload/storage is not connected. Saved vehicles use device-local storage. Offline mode retains pickup essentials and drafts; it does not queue live location or meeting actions.

Session expiry, account recovery, authentication throttling, same-origin mutation checks and standard security headers are implemented. Further work before a public launch includes privacy/retention controls, invitation renewal, penetration testing, operational observability and a deployment-specific content security policy. Do not expose this development server directly to the public internet.

Set `PORT` and `DB_PATH` as needed. Invitation links currently expire seven days after creation. No example pickups or fabricated GPS data are inserted.
