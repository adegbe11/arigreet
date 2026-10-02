/* Bridges to the Android (and later iPhone) app. The app's screens are built
   into the phone; only data goes to the Arigreet server. In a normal browser
   every function here does nothing, so the website is unchanged. */
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "android" | "ios" | "web"

/* Where the app sends data. Set at build time with ARIGREET_URL (scripts/cap-url.mjs). */
export const API_BASE = isNative ? (import.meta.env.VITE_API_URL || "https://app.arigreet.com").replace(/\/$/, "") : "";
/* The public address used in links you send (https://arigreet.com/g/…). */
export const SITE = isNative ? API_BASE : location.origin;

/* Inside the app, "/api/…" calls go to the server. Done once, before anything loads. */
if (isNative) {
  const toServer = (u) => (typeof u === "string" && u.startsWith("/api/") ? API_BASE + u : u);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => nativeFetch(toServer(input), init);
  const ES = window.EventSource;
  if (ES)
    window.EventSource = class extends ES {
      constructor(url, opts) {
        super(toServer(url), opts);
      }
    };
  // The phone's own share sheet.
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async ({ title, text, url }) => {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: title });
    },
  });
  // Keep the screen on while the GreetBoard shows.
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async () => {
        const { KeepAwake } = await import("@capacitor-community/keep-awake");
        await KeepAwake.keepAwake();
        return { release: () => KeepAwake.allowSleep().catch(() => {}) };
      },
    },
  });
}

/* A short tap on the phone's vibration motor for big moments. */
export async function haptic(kind = "success") {
  if (!isNative) return navigator.vibrate?.(kind === "success" ? [30, 40, 30] : 20);
  const { Haptics, NotificationType, ImpactStyle } = await import("@capacitor/haptics");
  if (kind === "success") return Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  if (kind === "warning") return Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  return Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/* Google sign-in inside the app: Android's own account picker. Returns an ID token. */
export async function nativeGoogleToken(webClientId) {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({ google: { webClientId, iOSServerClientId: webClientId, mode: "online" } });
  const r = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
  const token = r?.result?.idToken;
  if (!token) throw Error("Google sign-in was cancelled.");
  return token;
}

/* Ask for alert permission and return the Firebase token for this phone. */
export async function nativePushToken() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") throw Error("Alerts are off. You can turn them on in your phone’s settings.");
  if (platform === "android")
    await PushNotifications.createChannel({
      id: "greets",
      name: "Pickup updates",
      description: "Landed, ready, nearby and “can’t find you”",
      importance: 5,
      vibration: true,
      visibility: 1,
    }).catch(() => {});
  return new Promise((resolve, reject) => {
    const done = [];
    const clean = () => done.forEach((h) => h.remove?.());
    PushNotifications.addListener("registration", (t) => (clean(), resolve(t.value))).then((h) => done.push(h));
    PushNotifications.addListener("registrationError", () => (clean(), reject(Error("Couldn’t turn on alerts on this phone. Try again later."))))
      .then((h) => done.push(h));
    PushNotifications.register();
  });
}

/* Hardware back button, status bar, tapping an alert, and pickup links
   (https://…/g/…) that open the app. */
export async function nativeSetup({ onBack, onOpen, onLink }) {
  if (!isNative) return () => {};
  const [{ App }, { StatusBar, Style }, { PushNotifications }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/push-notifications"),
  ]);
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor?.({ color: "#ffffff" }).catch(() => {});
  const link = (url) => {
    const m = String(url || "").match(/\/g\/([a-z0-9]+)/i);
    if (m) onLink?.("/g/" + m[1].toLowerCase());
  };
  const launch = await App.getLaunchUrl().catch(() => null);
  if (launch?.url) link(launch.url);
  const handles = await Promise.all([
    App.addListener("backButton", () => {
      if (!onBack()) App.minimizeApp();
    }),
    App.addListener("appUrlOpen", (e) => link(e.url)),
    PushNotifications.addListener("pushNotificationActionPerformed", (a) => onOpen(a.notification?.data?.url)),
  ]);
  return () => handles.forEach((h) => h.remove());
}
