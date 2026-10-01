# ARIGREET — Complete Product Flow (source of truth)

Written by Ade, 30 Sept 2026. Every screen is built and checked against this file.
Three separate flows: **Onboarding**, **Create a Greet** (Greeter), **Guest journey**. Never mix them.

## 1. What Arigreet is
Arigreet helps an arriving passenger and the person waiting for them find each other at the airport.
It replaces the driver standing in Arrivals holding a name while both sides call or message
("Where are you?", "Which exit?", "I can't see you.", "I'm beside the information desk.").

Arigreet combines: pickup information + passenger link + temporary live location + distance + messaging +
digital name board + visual beacon + meeting confirmation.

Journey: **CREATE → SHARE → ARRIVE → I'M READY → FIND → SEE → MEET → DONE**

## 2. Two people use Arigreet
**GREETER** — the person waiting at the airport: chauffeur, airport-transfer driver, hotel driver, tour operator,
company representative, friend, family member.

**GUEST** — the arriving passenger. Does not need an account and must not be forced to install the app.
The Greeter sends the Guest a secure link.

## 3. Brand / design system
- Brand: ARIGREET · Tagline: **From arrival to hello.**
- Product description: **Find the person waiting for you at the airport.**
- Pure White `#FFFFFF` — primary UI canvas
- International Klein Blue `#002FA7` — primary brand/action colour
- Neon Lime `#CCFF00` — sparingly, for live, ready, proximity and recognition states
- No gradients as the default brand treatment.
- Premium modern Apple feel: predominantly white, lots of negative space, precise typography, minimal borders,
  native-feeling sheets, large touch targets, restrained animation, almost no clutter, content before decoration,
  photography only where it communicates something, Klein Blue for primary interaction, Neon Lime only when
  something is active/live/important.

## 4. First app launch
A first-time user must NOT immediately see: account registration, location permission, notification permission,
flight form, tutorial carousel, feature list. First teach them what Arigreet is.

## 5. Screen 01 — Splash
Pure white. Centred Arigreet mark. Underneath: "Arigreet". Optional small tagline "From arrival to hello."
Display briefly, then continue automatically. No buttons.

## 6. Screen 02 — Welcome
Premium Arrivals photography that communicates **meeting**, not departure: an arriving traveller coming through the
Arrivals Hall and recognising the person waiting. Never someone walking toward an aircraft. Never a digital name
readable from the passenger's impossible viewing angle.
- Copy: "From arrival / to hello."
- Description: "Set up a pickup, send a link, and find each other the moment they land."
- Primary: **Get Started** · Small secondary: **Sign In**
- That's all. No feature cards.
- Shown once. After Get Started or Sign In, the app opens on Home every time.

## 7. After Get Started — straight to Home *(revised 30 Sep 2026; the intent screen was removed)*
People who download the app are greeters. Passengers never need the app: their link opens in the browser.
So there is no "What do you want to do?" question. Get Started opens Home:
- "Good morning" and a large **+ Create Greet** button
- Empty state: "No Greets yet"
- Underneath, for the rare passenger who downloads anyway: "Have an Arigreet link? Open it →" (opens a sheet to paste or scan the link)
- "Already use Arigreet? Sign in"

Never ask "Are you a driver?". A person could meet their mother today and be an arriving passenger tomorrow.

## 8. Create Greet from Home
They become the Greeter for this Greet. Create Greet takes them straight into the form. No more marketing.
The account is asked for only at the end, when they save their first Greet (§17).

## 9–16. Greeter — Create Greet
- **04 Who are you meeting?** Guest name (e.g. Helen Johnson). Optional: guest phone, email, photo. Continue.
- **05 When are they arriving?** Flight number (A3 123), arrival date, airport (Athens (ATH)). Auto-fill airline,
  scheduled arrival, terminal, status when possible, but manual always works. "No flight? Enter details manually". Continue.
- **06 Where will you meet?** Airport, terminal, arrivals area, exit/door, landmark, meeting instructions
  (e.g. "Arrivals Hall · Exit 3", "I'll be beside the information desk."). Airport map selection only if real map
  data exists. Never fabricate indoor maps.
- **07 Who should Helen look for?** Greeter name, greeter photo, company name (optional), company logo (optional),
  phone (optional). Appears on Helen's link.
- **08 Your vehicle** (skippable). Make/model, colour, licence plate, vehicle photo. "Save this vehicle". Continue.
- **09 Anything else?** (optional) Passengers, bags, child seat, accessibility assistance, additional note.
- **10 Your GreetBoard.** Preview "HELEN / JOHNSON". Options: full name / first name, company logo, flight number,
  light / dark, portrait / landscape. Generates a simple recognition identifier, e.g. **Klein Blue + ●●●**.
  Guest later sees "Look for Klein Blue ●●●". Keep customisation extremely limited. Not Canva.
- **11 Review — "Ready to meet Helen?"** Helen Johnson · A3 123 · Athens ATH · 14:20 · Terminal 1 ·
  Arrivals Hall · Exit 3 · Michael Collins · Black Mercedes-Benz V-Class · ABC-1234 · GreetBoard preview.
  Primary **Create Greet** · Secondary **Edit**.

## 17. Account creation
Unauthenticated Greeter is asked now, after creating something valuable.
"Save your Greet" — Continue with Apple · Continue with Google · Continue with Email.
"Create an account to manage this Greet and future pickups." The Guest never creates an account.

## 18. Screen 12 — Greet created
✓ "Greet created" · Helen Johnson · A3 123 · Athens · Tuesday · 14:20.
Primary **Send to Helen** · Secondary **View Greet**, **Show GreetBoard**.

## 19. Screen 13 — Share
Secure URL `arigreet.com/g/[secure-token]` (never predictable/sequential IDs).
Options: WhatsApp, Messages, Email, Copy Link, QR Code, More.
Suggested message: "Hi Helen, I'm meeting you at Athens Airport. Open this link when you arrive so we can find each other."
Helen never has to download Arigreet.

## 20. Greeter Home
"Good morning, Michael" · Primary **+ Create Greet**.
Sections: **Active** (Helen Johnson · A3 123 · Athens · 14:20 · Waiting for arrival), **Today**, **Upcoming**.
Bottom navigation: Home · Greets · Messages · Profile.

## 21. Greet detail
Helen Johnson · Flight A3 123 · Athens ATH · Arrival 14:20 · Terminal 1 · Meeting point · Vehicle · GreetBoard.
Timeline: Link sent ✓ · Helen opened link ✓ · Flight arriving · Waiting for Helen · later Helen is ready ·
Live Greet · Met ✓.
Actions: Message Helen · Call · Show GreetBoard · Edit · Cancel Greet.

## 22. Guest journey
Helen gets the link by WhatsApp/SMS/email and taps it. She must NOT see: download app, create account, password,
registration, subscription. The secure mobile web page is her Arigreet experience.

## 23. Guest 01 — Invitation
Logo · "Michael is waiting for you." · Athens Airport · Today · 14:20 ·
"When you're ready, Arigreet will help you find each other." · Primary **View my pickup** ·
Small: "No app or account required."

## 24. Guest 02 — Pickup details
Michael prominent: photo, Michael Collins, Elite Transfers. Vehicle: Black Mercedes-Benz V-Class. Plate: ABC-1234.
Meeting point: Arrivals Hall · Exit 3. Instruction: "I'll be beside the information desk."
Actions: Message Michael · Call Michael. Then: Flight A3 123 · 14:20 · Terminal 1.

## 25. Guest 03 — Help Michael recognize you (optional)
Photo (optional), What are you wearing? (Cream jacket), Bags (2), Bag description (Blue suitcase), Additional note.
Save. "Only Michael can see this information during your Greet." Helen can skip everything.

## 26. Before arrival
Same link, any time: "Michael is meeting you." · Flight A3 123 · Athens · 14:20 · Meeting point Exit 3.
No location sharing yet.

## 27. Flight lands
If flight data available: "Welcome to Athens, Helen. Michael is waiting for you."
"Have you collected your bags?" **YES, I HAVE MY BAGS** · **NOT YET** · (no checked luggage) **I DON'T HAVE CHECKED BAGS**.
Flight-data failure never blocks the experience; Helen can proceed manually.

## 28. Baggage state
NOT YET → "Take your time. Michael knows you're collecting your bags." Primary **I HAVE MY BAGS**.
Michael sees: "Helen is collecting baggage."

## 29. The most important button
"Ready to meet Michael?" · "When you tap I'm Ready, Arigreet can help you find each other." · Large **I'M READY**.

## 30. Location permission — only now
"Share your location with Michael" · "Your location helps you find each other at the airport."
Three points: Only shared during this Greet · Only Michael can see it · Stops when you meet or end sharing.
Primary **Share My Location** · Secondary **Not Now**. Only after this does the OS/browser prompt appear.

## 31. Michael receives alert
"Helen is ready. Helen has collected her bags and is ready to meet." Primary **Find Helen** · Secondary **Message Helen**.
Ask Michael for location now if not granted. No permanent background location unless genuinely necessary.

## 32–34. Live Greet
Both temporarily share location.
Helen's map: large map, markers YOU / MICHAEL. Top card "Michael is 84 m away · About 2 min" · "Moving toward you"
(only if reliable). Bottom: Message · Call · Meeting Point · Stop Sharing. No clutter.
Michael's map: "Helen is 84 m away · About 2 min". Actions: Message · Call · Show GreetBoard · Meeting Point.

## 35. Location accuracy
Never pretend GPS is more accurate than it is. "Approximate location" indoors; "Helen's location signal is weak."
when stale. If unavailable, fall back to meeting point, messaging, calling, GreetBoard, GreetBeacon.
Arigreet must stay usable when indoor GPS is poor.

## 36. Proximity
84 m → 52 m → 31 m → 18 m. The experience changes progressively; don't wait for zero.

## 37. Nearby mode (configurable threshold)
Helen: "Michael is nearby. 18 m · Look for Klein Blue ●●●" · Primary **FLASH MY GREETER** · Secondary Message.
Michael: "Helen is nearby. 18 m" + her info if given (Cream jacket, Blue suitcase, photo) · Primary **SHOW GREETBOARD**.

## 38. Flash my greeter
Real-time signal to Michael: vibrate where allowed, open/highlight GreetBoard, board pulses, optional short sound if
enabled. Never scream names continuously. No aggressive strobing. Stops automatically after several seconds.
Rate-limited.

## 39. GreetBoard
Almost all UI disappears. Full screen "HELEN / JOHNSON". Klein Blue `#002FA7` background, Pure White name,
Neon Lime `#CCFF00` recognition indicator. Portrait and landscape. Keep screen awake where permitted.
Maximum visibility, minimal controls.

## 40. GreetBeacon
When Helen flashes: Michael's board pulses; Michael sees "Helen is looking for you."
Helen sees "Your greeter is flashing. Look for Klein Blue ●●●".

## 41. Very close (≈5–10 m, where accuracy supports it)
Stop encouraging map-staring.
Helen: "Look up 👋 · Michael is very close. · Look for Klein Blue ●●●" · **FLASH MY GREETER** · **I SEE MICHAEL**.
Michael: "Helen is very close." · Cream jacket · Blue suitcase · photo · **SHOW GREETBOARD** · **I SEE HELEN**.

## 42. Meeting confirmation
Never auto-complete because GPS positions overlap. One taps I SEE MICHAEL / I SEE HELEN →
"Did you find each other?" **YES, WE'VE MET** · **NOT YET**. Mutual confirmation, or one confirmed completion with
proper state handling.

## 43. Completion — Helen
Large green success. "You're together." "Pickup complete." "Location sharing has stopped." Primary **Done**.
Optional: Rate experience. No forced account creation.

## 44. Completion — Michael
"Greet complete." Helen Johnson · Met at 14:32 · Ready → Met: 12 min · Location sharing: Stopped.
**Done** · **Create another Greet**.

## 45. No chat — one-tap status buttons *(revised 1 Oct 2026)*
Arigreet is not a messaging app. Every update is a button, and the app tells the other person:
I'VE LANDED · NOT YET (collecting bags) · I HAVE MY BAGS · I'M READY · I'm at Exit 3 (meeting point) ·
FLASH MY GREETER · I see you · YES, WE'VE MET. "Nearby" and "very close" are sent automatically.
Status taps work offline: I've landed, Collecting bags and the meeting point are kept on the phone and
sent the moment it reconnects. If people need to talk, they call (when a number was added).

## 46. Notifications (no spam)
Michael: Helen opened your Greet · Helen's flight has landed · Helen is collecting baggage · Helen is ready ·
Helen is nearby · Helen flashed your GreetBoard.
Helen: Michael is at the meeting point · Michael sent you a message · Michael is nearby.

## 47. Greets screen
Tabs: Active · Upcoming · Completed · Cancelled. Card: guest, airport, flight, date/time, status. Search/filter when needed.

## 48. Profile
Name · Photo · Company · Phone · Email · Default GreetBoard · Saved vehicles · Language · Notification settings ·
Privacy · Help · Sign out.

## 49. Saved vehicles
Vehicle photo, make/model, colour, plate. Pick one when creating future Greets.

## 50. Business use later
Architecture should allow hotels, transfer companies, chauffeur fleets, tour companies, cruise terminals,
train stations, events. Do not clutter V1. Airport meet-and-greet first.

## 51. Edge states (must be built)
Loading · No internet · Poor internet · Location denied · Location unavailable · Weak GPS · Passenger stops location ·
Greeter stops location · Invalid invitation · Expired invitation · Cancelled Greet · Flight delayed ·
Flight cancelled · Flight information unavailable · Passenger …

*Completed by the developer (original text was cut off):*
- Passenger landed but hasn't opened the link (20 min after arrival) → greeter sees "Send again" and "Call".
- Passenger opened the link or is at baggage for a long time (60 / 75 min) → greeter is nudged to message.
- Pickup details changed while the passenger is viewing (meeting point, vehicle, time) → passenger sees a notice.
- Other person's location stopped updating → "X's location hasn't updated for N min", meeting point shown.
- Your own location off or not updating → "Your location is off" with a Share my location button.
- Signed-out session → greeter returns to sign in; passenger links never need an account.

## 52. Production audit, 1 Oct 2026 *(built)*
- **Create a Greet: 3 steps** (who, arrival, where you'll wait), then Create. Your details, vehicle,
  passengers and GreetBoard style are under "Add more · optional" on the review screen.
- **Alerts**: after the link is sent, the greeter is asked to turn on alerts. On iPhone the app explains
  Add to Home Screen first, because iOS only delivers web alerts to Home Screen apps.
- **Greeter status**: On my way · Running late (+10/+20/+30 min) · At Arrivals. One tap; the passenger
  sees it at the top of her pickup and gets an alert where her phone allows it.
- **"I can't find you"** for the passenger after landing: the greeter is alerted, his GreetBoard opens and
  flashes, and she sees his name, meeting point, vehicle and a Call button.
- **Link preview**: passenger links show "Michael Collins is meeting you at Athens Airport" in WhatsApp,
  iMessage and SMS. Links are marked noindex.
- **Reopening the link** goes straight to the pickup; the invitation screen shows once.
- **Meeting point** ("I'm at Exit 3") is a full-width button on both sides; it beats GPS indoors.
- **Ending**: if only one person confirms "We've met", the Greet closes by itself after 10 minutes
  (CONFIRM_TIMEOUT_MINUTES). GPS alone never completes a Greet.

