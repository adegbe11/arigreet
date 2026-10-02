/* Privacy policy and terms, written once and used by both the website
   (website/build.mjs) and the app (src/Legal.jsx).
   Who runs Arigreet: fill in OPERATOR.name with your full legal name. */

export const OPERATOR = {
  name: "", // full legal name of the person who runs Arigreet
  country: "Greece",
  email: "hello@arigreet.com",
};
export const LEGAL_UPDATED = "2 October 2026";

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const who = (o) => (o.name ? `${esc(o.name)}, an individual based in ${esc(o.country)}` : `the individual who runs Arigreet, based in ${esc(o.country)}`);
const mail = (o) => `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`;

export const PRIVACY_LEDE =
  "Arigreet helps two people find each other at an airport. We collect as little as that needs, keep it only as long as it’s useful, and never sell it.";
export const TERMS_LEDE = "Use Arigreet to meet people who expect to meet you, and be kind.";

export function privacyHtml(o = OPERATOR, retentionDays = 30) {
  return `
<h2>Who is responsible</h2>
<p>Arigreet (arigreet.com and the Arigreet apps) is run by ${who(o)}. That person is the data controller under the EU General Data Protection Regulation (GDPR). For anything about your data, write to ${mail(o)}. We reply within one month.</p>

<h2>What we collect</h2>
<h3>Visiting the website</h3>
<ul>
<li>No cookies, no tracking, no advertising, no analytics that identify you.</li>
<li>Our hosting provider keeps short technical logs (IP address, time, page) to deliver the site and protect it from attacks.</li>
<li>The greeting board generator runs in your browser. The names you type are not sent to us.</li>
</ul>
<h3>If you create Greets (the greeter)</h3>
<ul>
<li>Your name, email and a securely hashed password, or your Google account name and email if you choose Continue with Google.</li>
<li>What you add to your profile: photo, company, phone, saved vehicles.</li>
<li>Each Greet you create: the passenger’s name and any phone, email or photo you add, the flight, airport, time and meeting point. Only add details the passenger is happy for you to share.</li>
</ul>
<h3>If you open a Greet link (the passenger)</h3>
<ul>
<li>No account and no email. The link is your key.</li>
<li>The taps you make, such as “I’ve landed” and “I’m ready”, and anything you choose to add so you can be recognised.</li>
</ul>
<h3>Location</h3>
<ul>
<li>Only after you tap I’m ready (passenger) or Find (greeter) and allow it on your phone.</li>
<li>Only shown to the other person on that Greet.</li>
<li>Deleted as soon as you stop sharing, the meeting is confirmed, or the Greet ends. We keep no location history.</li>
</ul>
<h3>On your device</h3>
<ul>
<li>The app stores a few things on your phone so it works: your sign-in, your language, a draft Greet, and a copy of your pickup so it still works with no signal. These are needed for the service and are removed when you sign out or the Greet ends. We use no cookies.</li>
</ul>
<h3>Alerts</h3>
<ul>
<li>If you turn on alerts, your phone gives us a push address. Alerts are delivered by your phone’s push service (Apple, Google or Mozilla).</li>
</ul>

<h2>Why we use it, and on what legal basis</h2>
<ul>
<li><b>Running the pickup you asked for</b> (accounts, Greets, taps, the board): to perform our agreement with you (GDPR Art. 6(1)(b)).</li>
<li><b>Live location and alerts</b>: your consent (Art. 6(1)(a)). You can withdraw it at any time with Stop sharing, by turning alerts off, or in your phone’s settings.</li>
<li><b>Security logs and preventing abuse</b>: our legitimate interest in keeping the service safe (Art. 6(1)(f)).</li>
</ul>
<p>We make no automated decisions about you and do no profiling.</p>

<h2>Who else handles it</h2>
<p>We use these providers only to run Arigreet. Each processes data on our instructions under a data processing agreement.</p>
<ul>
<li><b>Railway</b> (USA): hosts the app and its database.</li>
<li><b>Vercel</b> (USA): hosts the website.</li>
<li><b>MapTiler</b> (Switzerland): draws the map; your phone requests map images for the area on screen.</li>
<li><b>Google</b> (USA): only if you use Continue with Google, and to deliver Android alerts.</li>
<li><b>FlightAware</b> (USA): receives flight numbers only, to show arrival times. No personal details.</li>
<li><b>Namecheap</b> (USA): forwards email sent to ${mail(o)}.</li>
</ul>
<p>Where data goes outside the European Economic Area, it is protected by the EU–US Data Privacy Framework for certified companies, the European Commission’s adequacy decision for Switzerland, or the Commission’s Standard Contractual Clauses.</p>
<p>We never sell your data, show ads, or share it for marketing.</p>

<h2>How long we keep it</h2>
<ul>
<li>Live location: until the Greet ends, then deleted.</li>
<li>A finished, cancelled or expired Greet: deleted automatically ${Number(retentionDays) || 30} days later.</li>
<li>Your account: until you delete it. Profile → Delete account removes it and every Greet you created at once.</li>
<li>Hosting logs: kept by our providers for a short period, usually up to 30 days.</li>
</ul>

<h2>Your rights</h2>
<p>You can ask to see, correct, delete or export your data, to restrict or object to how we use it, and you can withdraw consent at any time. Write to ${mail(o)}. You can delete your account yourself in the app, or follow the steps on <a href="https://arigreet.com/delete-account/">arigreet.com/delete-account</a>.</p>
<p>You can also complain to a data protection authority. In Greece that is the Hellenic Data Protection Authority, Kifisias 1–3, 115 23 Athens, <a href="https://www.dpa.gr">dpa.gr</a>. You can also contact the authority where you live.</p>

<h2>Security</h2>
<p>Connections are encrypted (HTTPS). Passwords are stored as hashes, never in plain text. Greet links are long random keys. Access to the database is limited to the operator.</p>

<h2>Children</h2>
<p>Accounts are for people 16 and over. A younger traveller can open a Greet link sent by a parent or carer.</p>

<h2>Changes</h2>
<p>If this policy changes in a way that matters, we’ll show it in the app before it applies. The date at the bottom shows the latest version.</p>`;
}

export function termsHtml(o = OPERATOR) {
  return `
<h2>Who provides Arigreet</h2>
<p>Arigreet is provided by ${who(o)}. Contact: ${mail(o)}.</p>

<h2>The service</h2>
<p>Arigreet lets a greeter set up an airport pickup and send one link, and lets the passenger share their progress and, if they choose, their location until they meet. It is free to use.</p>

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
<li>Don’t upload anything illegal, abusive or that you don’t have the right to share.</li>
<li>Don’t try to break, overload or get around the app’s security.</li>
</ul>
<p>We can suspend accounts that break these rules. To report misuse, write to ${mail(o)}.</p>

<h2>What we can and can’t promise</h2>
<ul>
<li>Location, flight times and alerts depend on phones, networks and airports, and can be late or wrong. Agree a meeting point and a way to call each other too.</li>
<li>Arigreet isn’t a transport, security or emergency service. In an emergency, contact airport staff or call 112.</li>
<li>We can’t guarantee the service is always available. As far as the law allows, we aren’t liable for missed or late pickups. Nothing in these terms limits your rights as a consumer under the law of the country where you live.</li>
</ul>

<h2>Your content</h2>
<p>Names, photos and notes you add stay yours. You let us store them and show them to the other person on the Greet, only to run the pickup.</p>

<h2>Changes and law</h2>
<p>If these terms change in a way that matters, we’ll tell you in the app first. These terms are governed by Greek law. If you are a consumer in the EU, you also keep the protection of the mandatory laws of the country where you live, and can bring a claim there.</p>`;
}

export function deleteAccountHtml(o = OPERATOR) {
  return `
<h2>Delete it yourself, in the app</h2>
<ol>
<li>Open Arigreet and sign in.</li>
<li>Go to Profile.</li>
<li>Tap Delete account and confirm.</li>
</ol>
<p>Your account, your profile and every Greet you created are deleted at once. This can’t be undone.</p>

<h2>Or ask us</h2>
<p>Email ${mail(o)} from the address on your account with the subject “Delete my account”. We delete it within 30 days, usually much sooner, and confirm by email.</p>

<h2>What is deleted, and what is kept</h2>
<ul>
<li>Deleted: your name, email, password, photo, company, phone, vehicles, alert subscriptions, and all Greets you created, including passenger details and any location.</li>
<li>Kept: nothing from your account. Our hosting providers’ short technical logs expire on their own, usually within 30 days.</li>
</ul>
<p>Passengers don’t have accounts. A Greet and everything in it is deleted automatically 30 days after it ends.</p>`;
}
