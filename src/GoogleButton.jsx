/* Continue with Google. In the Android app it opens the phone's own Google
   account picker; on the website it uses Google's official button. If the
   server has no Google client ID yet, nothing shows. */
import React, { useEffect, useRef, useState } from "react";
import { isNative, nativeGoogleToken } from "./native.js";

let config;
const clientId = () =>
  (config ||= fetch("/api/config")
    .then((r) => r.json())
    .then((c) => c.google || "")
    .catch(() => ""));

let gis;
const loadGis = () =>
  (gis ||= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = ok;
    s.onerror = () => ((gis = null), fail(Error("Couldn’t reach Google. Check your connection.")));
    document.head.appendChild(s);
  }));

const G = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-16.8z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
  </svg>
);

export default function GoogleButton({ onToken, onError, disabled }) {
  const [id, setId] = useState(null);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const cb = useRef();
  cb.current = { onToken, onError };
  useEffect(() => {
    clientId().then(setId);
  }, []);
  useEffect(() => {
    if (!id || isNative || !box.current) return;
    let live = true;
    loadGis()
      .then(() => {
        if (!live || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: id,
          callback: (r) => cb.current.onToken(r.credential),
          ux_mode: "popup",
          itp_support: true,
        });
        window.google.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          width: Math.min(400, box.current.offsetWidth || 320),
        });
      })
      .catch((e) => cb.current.onError?.(e.message));
    return () => {
      live = false;
    };
  }, [id]);
  if (!id) return null;
  if (!isNative) return <div className="g-btn-web" ref={box} />;
  return (
    <button
      type="button"
      className="g-btn"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onToken(await nativeGoogleToken(id));
        } catch (e) {
          if (!/cancel/i.test(e.message || "")) onError?.(e.message || "Google sign-in didn’t work. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <G /> {busy ? "Please wait…" : "Continue with Google"}
    </button>
  );
}

/* "or" between Google and email. */
export const Or = () => (
  <div className="g-or" role="separator">
    <span>or</span>
  </div>
);
