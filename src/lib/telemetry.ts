export type DagitEvent =
  | "proof_started"
  | "file_hash_started"
  | "file_hash_completed"
  | "file_hash_failed"
  | "wallet_connect_requested"
  | "wallet_connected"
  | "wallet_connect_failed"
  | "proof_anchor_requested"
  | "proof_recorded"
  | "proof_anchor_failed"
  | "receipt_downloaded"
  | "proof_link_copied"
  | "proof_qr_created"
  | "certificate_printed"
  | "verification_started"
  | "verification_matched"
  | "verification_mismatched"
  | "verification_chain_unavailable"
  | "company_access_selected"
  | "company_registration_selected"
  | "company_registration_started"
  | "company_wallet_signature_requested"
  | "company_workspace_activated"
  | "company_registration_failed"
  | "company_access_started"
  | "company_access_completed"
  | "company_access_empty"
  | "company_access_failed";

declare global {
  interface Window {
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
  }
}

const consentKey = "dagit.analytics.consent";
const gtmContainerId = import.meta.env.VITE_GTM_CONTAINER_ID?.trim();
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
let scriptRequested = false;
let gaScriptRequested = false;

export function analyticsConsent(): "granted" | "denied" | null {
  const value = window.localStorage.getItem(consentKey);
  return value === "granted" || value === "denied" ? value : null;
}

function loadGtm() {
  if (!gtmContainerId || scriptRequested) return;
  scriptRequested = true;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmContainerId)}`;
  document.head.appendChild(script);
}

function loadGoogleAnalytics() {
  if (!gaMeasurementId || gaScriptRequested) return;
  gaScriptRequested = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  document.head.appendChild(script);
  window.gtag("js", new Date());
  // GTM owns the public-page pageview. Direct gtag calls below carry only the
  // allowlisted product events so page views are not duplicated.
  window.gtag("config", gaMeasurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

export function setAnalyticsConsent(value: "granted" | "denied") {
  window.localStorage.setItem(consentKey, value);
  if (value === "granted") {
    loadGtm();
    loadGoogleAnalytics();
  }
}

export function initializeTelemetry() {
  if (analyticsConsent() === "granted") {
    loadGtm();
    loadGoogleAnalytics();
  }
}

/**
 * Product metrics deliberately have no event properties. Do not add filenames,
 * hashes, receipt data, wallet addresses, matter references, emails, or any
 * document/signing metadata here.
 */
export function track(event: DagitEvent) {
  if (analyticsConsent() !== "granted") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event });
  if (gaMeasurementId) window.gtag?.("event", event);
}
