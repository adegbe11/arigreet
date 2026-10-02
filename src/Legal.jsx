import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { PinMark, Wordmark } from "./Brand.jsx";
import { OPERATOR, LEGAL_UPDATED, PRIVACY_LEDE, TERMS_LEDE, privacyHtml, termsHtml } from "./legal-content.js";

/* Privacy policy and terms. The words live in legal-content.js so the website
   and the app always show the same text. */

function useRetention() {
  const [days, setDays] = useState(30);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => c.legal?.retentionDays && setDays(c.legal.retentionDays))
      .catch(() => {});
  }, []);
  return days;
}

export default function Legal({ page }) {
  const days = useRetention();
  const terms = page === "terms";
  useEffect(() => {
    document.title = (terms ? "Terms" : "Privacy") + " · Arigreet";
  }, [terms]);
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
        <h1>{terms ? "Terms" : "Privacy"}</h1>
        <p className="lg-lede">{terms ? TERMS_LEDE : PRIVACY_LEDE}</p>
        <div dangerouslySetInnerHTML={{ __html: terms ? termsHtml(OPERATOR) : privacyHtml(OPERATOR, days) }} />
        <p className="lg-foot">
          Last updated {LEGAL_UPDATED} · {terms ? <a href="/privacy">Privacy</a> : <a href="/terms">Terms</a>}
        </p>
      </main>
    </div>
  );
}
