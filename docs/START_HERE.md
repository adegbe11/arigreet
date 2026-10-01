# Arigreet: from this folder to a working app on your phone

Read this first. Every step below needs your own login or payment, so only
you can do it. Everything else (the code, the build setup, the settings
files) is done.

**How Arigreet works, in one minute**

- **The server** is the brain. It stores pickups, follows flights, sends
  alerts and passes live location between the two phones. It has to be
  online, on Render, before anything works for real.
- **The Android app** is what greeters install. Its screens are built into
  the phone, so it opens instantly even with bad signal. It talks to the
  server for data.
- **The passenger** never installs anything. They tap the link you send,
  and it opens in their browser. If they do have the app, the link opens
  the app instead.

Do the steps in order. Total time: about 2 hours, plus Google's 14-day test.

---

## 1. Put the code on GitHub (10 min)

1. Make a free account at github.com if you don't have one.
2. Install **GitHub Desktop** (desktop.github.com) and sign in.
3. **File → Add local repository →** choose the `AriMeet` folder.
   Everything is already committed for you.
4. Click **Publish repository**. Name it `arigreet` and keep **Private** ticked.

The build scripts are already in `.github/workflows`, so GitHub starts
building the Android app straight away. The first build will be missing
its keys; that's expected.

## 2. Put the server online with Render (15 min, about $7 a month)

1. Sign up at render.com with your GitHub account.
2. **New → Blueprint →** pick `arigreet`. Render reads `render.yaml`.
3. Fill in what it asks. For now you only need:
   - `PUBLIC_URL`: `https://arigreet.onrender.com` (or your own domain later)
   - `CONTACT_EMAIL`, `LEGAL_NAME`, `LEGAL_ADDRESS`
   - Leave the rest empty. You'll add the Google and Firebase ones below.
4. Deploy. When it says **Live**, open the address on your phone.
   The website works now.

The full list of extra services (flight data, email, maps) is in
`docs/LAUNCH.md`. You can add those any time; the app runs without them.

## 3. Firebase, for alerts (10 min, free)

1. console.firebase.google.com → **Create project** → `Arigreet`.
2. **Add app → Android**, package name `com.arigreet.app`.
   Download `google-services.json`.
3. **Project settings → Service accounts → Generate new private key.**
4. In Render → Environment, add `FIREBASE_SERVICE_ACCOUNT` and paste the
   whole content of that key file.

## 4. Continue with Google (15 min, free)

Use the same Google project Firebase just made.

1. console.cloud.google.com → pick the **Arigreet** project at the top.
2. **Google Auth Platform → Branding**: app name `Arigreet`, your support
   email, the logo (`assets/icon-only.png`), and your links:
   `https://YOUR-ADDRESS/privacy` and `https://YOUR-ADDRESS/terms`.
3. **Audience**: External. While it says *Testing*, add your own Gmail and
   your testers' under **Test users**. Press **Publish app** when you go live.
4. **Clients → Create client → Web application**, name `Arigreet web`.
   Under *Authorised JavaScript origins* add `https://YOUR-ADDRESS`.
   Copy the **Client ID**.
5. In Render, add `GOOGLE_WEB_CLIENT_ID` = that Client ID.
   "Continue with Google" now shows on the website.
6. The Android client comes in step 7, once your key exists.

## 5. GitHub secrets (5 min)

In your `arigreet` repo: **Settings → Secrets and variables → Actions →
New repository secret**.

| Secret | Value |
| --- | --- |
| `ARIGREET_URL` | your server address, e.g. `https://arigreet.onrender.com` |
| `GOOGLE_SERVICES_JSON` | the whole content of `google-services.json` |
| `ANDROID_KEYSTORE_PASSWORD` | a long password. Save it in your password manager |

## 6. Make your app signing key (3 min, once)

1. **Actions → Make Android upload key → Run workflow.**
2. Open the finished run and download **upload-key**.
3. Keep `upload.jks` safe (Google Drive and your password manager).
4. Add two more secrets: `ANDROID_KEYSTORE_BASE64` = the text inside
   `upload.jks.base64`, and `ANDROID_KEY_ALIAS` = `arigreet`.
5. Delete the download from the run page.

## 7. Build the app and install it (10 min)

1. **Actions → Android app → Run workflow.** It takes about 8 minutes.
2. Open the run, click the **Signing key** step, and copy the line that
   starts with `SHA1:`.
3. Back in Google Cloud: **Clients → Create client → Android**.
   Package name `com.arigreet.app`, paste the SHA-1. Save.
   (Nothing to copy back. This just tells Google your app is allowed.)
4. Download **arigreet-debug.apk** from the run, send it to your Android
   phone and open it. Allow "install unknown apps" once.

If the build fails, open the red step, copy the error and send it to me.

**Faster way to test, since you have Android Studio:** in a terminal in the
AriMeet folder run `npm install`, then `npm run build`, then
`npx cap sync android`, then `npx cap open android`. Android Studio opens the
project; plug in your phone and press **Run**. Google sign-in on that build
needs your laptop's debug SHA-1 added as another Android client in Google
Cloud (Android Studio: Gradle panel → app → Tasks → android → signingReport).

## 8. Test a real pickup (30 min)

With a friend on another phone:

1. In the app: Continue with Google, then **Create Greet** for your friend.
2. Send the link by WhatsApp. Your friend opens it in their browser.
3. Friend taps **I've landed**. Your phone should buzz with an alert.
4. Friend taps **I'm ready**. Both of you share location and walk towards
   each other. Check the map moves.
5. Open the GreetBoard. Friend taps **Make it flash**.
6. Tap **We met**.

Write down anything odd and send it to me.

## 9. Google Play (30 min, $25 once, then 14 days)

Follow section 5 of `docs/ANDROID.md`. The short version:

1. Developer account at play.google.com/console.
2. Create the app, upload **arigreet-release.aab** to *Closed testing*,
   accept Play App Signing.
3. **Setup → App signing**: copy the **SHA-1** and add a second Android
   client in Google Cloud with it (Google sign-in needs it for Play
   installs). Copy the **SHA-256** into Render as `ANDROID_CERT_SHA256`
   (pickup links then open the app).
4. Fill in the store listing (`docs/PLAY_LISTING.md`) and the forms.
5. Get at least 12 testers to join and keep it installed for 14 days.
   Then apply for production.
