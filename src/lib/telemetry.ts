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
  | "verification_chain_unavailable";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const consentKey = "dagit.analytics.consent";
const gtmContainerId = import.meta.env.VITE_GTM_CONTAINER_ID?.trim();
let scriptRequested = false;

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

export function setAnalyticsConsent(value: "granted" | "denied") {
  window.localStorage.setItem(consentKey, value);
  if (value === "granted") loadGtm();
}

export function initializeTelemetry() {
  if (analyticsConsent() === "granted") loadGtm();
}

/**
 * Product metrics deliberately have no event properties. Do not add filenames,
 * hashes, receipt data, wallet addresses, matter references, emails, or any
 * document/signing metadata here.
 */
export function track(event: DagitEvent) {
  if (analyticsConsent() !== "granted" || !gtmContainerId) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event });
}
