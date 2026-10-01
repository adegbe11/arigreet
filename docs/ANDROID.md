# Arigreet for Android (Google Play)

The Android app is the greeter's app. Passengers never need it: their link
keeps opening in the browser.

How it works: the app's screens are built into the phone, so it opens
instantly and never shows a blank page, even with weak signal at the airport.
It talks to your Arigreet server for data only. On top of that it adds what a
website can't do well: alerts that always arrive, Continue with Google using
the phone's own account picker, the share sheet, vibration, keeping the screen
on for the GreetBoard, the back button, and pickup links that open the app.

New here? Start with `docs/START_HERE.md`: it puts every step in order.

## 0. Build scripts

They're in `.github/workflows` (copies in `ci/`). GitHub runs them once the
code is on GitHub.

## 1. Firebase, for alerts (10 min, free)

1. Go to console.firebase.google.com → **Add project** → name it `Arigreet`
   (Google Analytics: off is fine).
2. In the project: **Add app → Android**. Package name: `com.arigreet.app`.
   Download `google-services.json`.
3. **Project settings → Service accounts → Generate new private key**.
   This downloads a JSON file.
4. In **Render → Environment**, add `FIREBASE_SERVICE_ACCOUNT` and paste the
   whole contents of that file. The server now sends Android alerts.

## 2. GitHub secrets (5 min)

In your `arigreet` repo: **Settings → Secrets and variables → Actions → New
repository secret**. Add:

| Secret | Value |
| --- | --- |
| `ARIGREET_URL` | your live address, e.g. `https://arigreet.com` |
| `GOOGLE_SERVICES_JSON` | the whole contents of `google-services.json` |
| `ANDROID_KEYSTORE_PASSWORD` | a long password; save it in your password manager |

## 3. Make your upload key (3 min, once)

No Java needed on your laptop.

1. **Actions → Make Android upload key → Run workflow**.
2. When it finishes, open the run and download **upload-key**.
3. Keep `upload.jks` somewhere safe (Google Drive + password manager). If you
   lose it, Google can reset it, but it takes days.
4. Add two more secrets: `ANDROID_KEYSTORE_BASE64` = the text inside
   `upload.jks.base64`, and `ANDROID_KEY_ALIAS` = `arigreet`.
5. Delete the artifact from the run page.

## 4. Build (automatic)

Every push to `main` builds the app. To build now: **Actions → Android app →
Run workflow**. In about 6 minutes the run has two downloads:

- **arigreet-debug.apk**: put it on your Android phone and open it to install
  (allow "install unknown apps" once). Test a full pickup with a friend.
- **arigreet-release.aab**: the file you upload to Google Play.

## 5. Google Play (about 30 min, plus the testing period)

1. Create a developer account at play.google.com/console ($25, once).
2. **Create app** → name `Arigreet`, App, Free.
3. **Testing → Closed testing** → create a track, upload `arigreet-release.aab`.
   Accept **Play App Signing** when asked.
4. Fill in the app content forms. Answers that match how Arigreet works:
   - **Privacy policy**: `https://YOUR-ADDRESS/privacy`
   - **Data safety**: collects *Approximate and precise location* (app
     functionality, only while sharing, not shared with third parties,
     deleted when the Greet ends), *Name, Email* (account), *Photos* (optional,
     app functionality). Data is encrypted in transit. Users can request
     deletion (Profile → Delete account).
   - **Location**: foreground only. No background location.
   - **Ads**: none. **Target audience**: 18+.
5. The store listing text is ready in `docs/PLAY_LISTING.md`. You'll need 2+
   phone screenshots: take them from the debug app on your phone.
6. **New personal accounts must run a closed test before going public:** at
   least 12 testers, opted in for 14 days in a row. Ask friends, drivers and
   hotel contacts. After 14 days, apply for production access in the console.

## What's native in the app

- Screens built into the app; only data goes to the server.
- Continue with Google with the phone's own account picker.
- The phone's share sheet, vibration on big moments, and the screen stays on
  while the GreetBoard shows.
- Pickup links open the app when it's installed (Android App Links).
- Alerts through Firebase: landed, bags, ready, nearby, "can't find you".
  An Android channel called "Pickup updates" sounds and vibrates.
- Tapping an alert opens the Greet that needs you.
- The back button closes sheets, then goes back, then minimises the app.
- Location uses Android's own permission prompt.
- The Arigreet pin icon (with a round version) and a white splash.
- Targets Android 16 (API 36), the level Google Play requires from 2026.

## Later

- iPhone: the same project builds for iOS with `npx cap add ios` and a cloud
  Mac (Codemagic). It needs the $99/year Apple Developer account.
- Location while the phone is locked needs a foreground-service plugin and a
  Google Play declaration. Leave it out until real pickups show it's needed.
