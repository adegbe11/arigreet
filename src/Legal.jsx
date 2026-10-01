import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { PinMark, Wordmark } from "./Brand.jsx";

/* Privacy policy and terms. Written in plain language to match the app.
   The operator's legal name, address and contact email come from the server
   (LEGAL_NAME, LEGAL_ADDRESS, CONTACT_EMAIL). Have a lawyer check before launch. */

const UPDATED = "1 October 2026";

function useLegal() {
  const [legal, setLegal] = useState({});
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setLegal(c.legal || {}))
      .catch(() => {});
  }, []);
  return legal;
}

function Privacy({ l }) {
  const who = l.name || "the operator of Arigreet";
  const mail = l.email ? <a href={"mailto:" + l.email}>{l.email}</a> : "the contact address in the app";
  const days = l.retentionDays || 30;
  return (
    <>
      <h1>Privacy</h1>
      <p className="lg-lede">
        Arigreet helps two people find each other at an airport. We collect as little as that needs, keep it only
        as long as it’s useful, and never sell it.
      </p>

      <h2>Who is responsible</h2>
      <p>
        Arigreet is run by {who}
        {l.address ? `, ${l.address}` : ""}. For anything about your data, write to {mail}.
      </p>

      <h2>What we collect</h2>
      <h3>If you create Greets (the greeter)</h3>
      <ul>
        <li>Your name, email and a scrambled version of your password.</li>
        <li>What you add to your profile: photo, company, phone, saved vehicles.</li>
        <li>Each Greet you create: the passenger’s name and any phone, email or photo you add, the flight, airport, time and meeting point.</li>
      </ul>
      <h3>If you open a Greet link (the passenger)</h3>
      <ul>
        <li>No account and no email. The link is your key.</li>
        <li>The taps you make, such as “I’ve landed” and “I’m ready”, and anything you choose to add so you can be recognised (a photo, what you’re wearing, your bags).</li>
      </ul>
      <h3>Location, for both</h3>
      <ul>
        <li>Only after you tap I’m Ready (passenger) or Find (greeter) and allow it on your phone.</li>
        <li>Only shared with the other person on that Greet.</li>
        <li>Deleted the moment you stop sharing, the meeting is confirmed, or the Greet is cancelled or expires. We don’t keep a history of where you’ve been.</li>
      </ul>
      <h3>Technical</h3>
      <ul>
        <li>If you turn on alerts, the push address your phone gives us.</li>
        <li>Flight numbers are looked up with a flight data provider to show arrival times. No personal details are sent.</li>
        <li>Your phone keeps a small copy of your pickup so it still works with no signal. It’s removed when the Greet ends.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To run the pickup you asked for: show the details, tell each person what the other is doing, and help you
        find each other. That is the legal basis (performing the service you requested). Location is only used with
        your permission, which you can withdraw at any time with Stop sharing or in your phone’s settings.
      </p>

      <h2>Who sees it</h2>
      <ul>
        <li>The two people on a Greet see that Greet’s details. Nobody else does.</li>
        <li>Our hosting, email and map providers process data only to run the service.</li>
        <li>We don’t sell data, show ads, or share it for marketing.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Live location: until the Greet ends, then deleted.</li>
        <li>A finished, cancelled or expired Greet: deleted automatically {days} days later.</li>
        <li>Your account: until you delete it. Profile → Delete account removes it and every Greet you created, at once.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you can ask to see, correct, export or delete your data, or object to how we use it. Write to{" "}
        {mail}. If you’re not happy with our answer you can complain to your data protection authority (in Greece,
        the Hellenic Data Protection Authority).
      </p>

      <h2>Children</h2>
      <p>Accounts are for people 16 and over. A child can open a Greet link sent by a parent or carer.</p>

      <h2>Changes</h2>
      <p>If this changes in a way that matters, we’ll say so in the app before it applies.</p>
    </>
  );
}

function Terms({ l }) {
  const who = l.name || "the operator of Arigreet";
  const mail = l.email ? <a href={"mailto:" + l.email}>{l.email}</a> : "the contact address in the app";
  return (
    <>
      <h1>Terms</h1>
      <p className="lg-lede">The short version: use Arigreet to meet people you’re genuinely meeting, and be kind.</p>

      <h2>The service</h2>
      <p>
        Arigreet is provided by {who}. It lets a greeter set up an airport pickup and send one link, and lets the
        passenger share their progress and, if they choose, their location until they meet.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 16 or over to create an account.</li>
        <li>Keep your password private. You’re responsible for Greets made from your account.</li>
        <li>You can delete your account at any time in Profile.</li>
      </ul>

      <h2>Using it fairly</h2>
      <ul>
        <li>Only create Greets for people who expect to be met by you, with details you’re allowed to share.</li>
        <li>Don’t use Arigreet to track, follow or contact anyone who hasn’t agreed to it.</li>
        <li>Don’t try to break, overload or get around the app’s security.</li>
      </ul>
      <p>We can suspend accounts that break these rules.</p>

      <h2>What we can and can’t promise</h2>
      <ul>
        <li>Location, flight times and alerts depend on phones, networks and airports, and can be late or wrong. Arigreet helps; it doesn’t replace agreeing a meeting point and a way to call each other.</li>
        <li>Arigreet isn’t a transport, security or emergency service. In an emergency, contact airport staff or local emergency services.</li>
        <li>We work hard to keep the app running but can’t guarantee it’s always available. As far as the law allows, we aren’t liable for missed or late pickups. Nothing here limits rights you have by law as a consumer.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Names, photos and notes you add stay yours. You let us store and show them to the other person on the Greet,
        only to run the pickup.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If these terms change in a way that matters, we’ll tell you in the app first. Questions: {mail}. These terms
        are governed by Greek law and EU consumer law.
      </p>
    </>
  );
}

export default function Legal({ page }) {
  const l = useLegal();
  useEffect(() => {
    document.title = (page === "terms" ? "Terms" : "Privacy") + " · Arigreet";
  }, [page]);
  return (
    <div className="lg">
      <header className="lg-head">
        <a className="glass-btn" href="/" aria-label="Back to Arigreet">
          <ChevronLeft size={24} />
        </a>
        <span className="gs-brand">
          <PinMark size={20} />
          <Wordmark />
        </span>
        <span />
      </header>
      <main className="lg-body">
        {page === "terms" ? <Terms l={l} /> : <Privacy l={l} />}
        <p className="lg-foot">
          Last updated {UPDATED} ·{" "}
          {page === "terms" ? <a href="/privacy">Privacy</a> : <a href="/terms">Terms</a>}
        </p>
      </main>
    </div>
  );
}
