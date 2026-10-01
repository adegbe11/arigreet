# Putting Arigreet online

The code is ready to go live. Everything below is set up already except the four
things only you can do, because each one needs your own account or card.

Total time: about 30 minutes.

## 1. Put the code on GitHub (5 min)

Render deploys from GitHub.

1. Make a free account at github.com if you don't have one.
2. Click **New repository**, name it `arigreet`, set it to **Private**, and create it.
3. On your laptop, open PowerShell in the AriMeet folder and run these lines. GitHub
   shows the same ones under "push an existing repository":

   ```
   git remote add origin https://github.com/YOUR-NAME/arigreet.git
   git add -A
   git commit -m "Arigreet"
   git branch -M main
   git push -u origin main
   ```

   If git asks who you are, run `git config --global user.name "Ade"` and
   `git config --global user.email "you@example.com"` once, then commit again.

   `.gitignore` already keeps your database, `.env` and `node_modules` out of GitHub.

## 2. Go live on Render (10 min)

1. Make an account at render.com and sign in with GitHub.
2. Click **New → Blueprint** and pick the `arigreet` repo.
   Render reads `render.yaml` and sets up the whole service for you:
   build, start command, health check, and a 1 GB disk so your data survives restarts.
3. It asks for the values marked secret. Fill in:
   - `PUBLIC_URL` — your web address, for example `https://arigreet.com`
     (use the `onrender.com` address Render gives you until your domain is ready)
   - `VAPID_SUBJECT` — `mailto:` plus your email, for example `mailto:hello@arigreet.com`
   - `FLIGHTAWARE_API_KEY` — from step 4 (you can leave it empty for now)
   - `SMTP_PASSWORD` and `MAIL_FROM` — from step 5 (you can leave them empty for now)
4. Click **Apply**. In a few minutes you get a working `https://arigreet.onrender.com` link.
   Open it on your phone: location sharing and notifications work, because it's HTTPS.

The plan in `render.yaml` is **Starter**, the cheapest one that keeps a disk.
The free plan wipes the data every restart, so it isn't safe for real pickups.

## 3. Your own domain (10 min)

1. Buy the domain (for example arigreet.com) from any registrar: Namecheap, Cloudflare, Porkbun.
2. In Render, open the service → **Settings → Custom Domains** → add `arigreet.com` and `www.arigreet.com`.
3. Render shows one or two DNS records. Add them at your registrar.
4. Render issues the HTTPS certificate on its own, usually within minutes.
5. Change `PUBLIC_URL` in Render to `https://arigreet.com`.

## 4. Live flight status (5 min, optional)

1. Sign up for FlightAware **AeroAPI** at flightaware.com/commercial/aeroapi and create an API key.
2. Paste it into `FLIGHTAWARE_API_KEY` in Render → **Environment**. The service restarts by itself.

Without a key the app still works. The guest sees the arrival time you typed in, and
"I've landed" still works.

## 5. Password reset emails (5 min, optional)

1. Make an account at resend.com and add your domain (Resend shows DNS records to add).
2. Create an API key.
3. In Render → **Environment**: paste the key into `SMTP_PASSWORD`, and set `MAIL_FROM` to
   something like `Arigreet <hello@arigreet.com>`.
   Host, port and user are already filled in by `render.yaml`.

Without email, everything works except "Forgot password".

## 6. Map tiles (5 min, needed before real customers)

OpenStreetMap's own servers are for development only.
1. Make a free account at maptiler.com and copy your API key.
2. Paste it into `MAPTILER_KEY` in Render → **Environment**.

## 7. Privacy and Terms (5 min, needed before real customers)

The app already has `/privacy` and `/terms` pages, written in plain language for GDPR.
1. In Render → **Environment**, fill in `LEGAL_NAME` (you or your company), `LEGAL_ADDRESS` and `CONTACT_EMAIL`.
2. Have a lawyer read both pages once. They're a solid draft, not legal advice.

## Checking it's healthy

`https://your-address/healthz` answers `{"ok":true}` when the server is up.
Render watches this address and restarts the app if it stops answering.
