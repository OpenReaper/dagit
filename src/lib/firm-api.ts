import type { Receipt } from "./proof-core";

export type FirmSession = { member: { email: string; role: string }; firm: { id: string; name: string } };
export type FirmMatter = { id: string; referenceAlias: string; documentRole: string; signingProvider: string; signingReference: string; status: string; createdAt: string; permission: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/firm/api/v1${path}`, { credentials: "same-origin", headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers }, ...init });
  const value: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof value === "object" && value && "error" in value && typeof value.error === "string" ? value.error : "Firm workspace request failed.");
  return value as T;
}

export const getFirmSession = () => request<FirmSession>("/session");
export const listFirmMatters = () => request<{ matters: FirmMatter[] }>("/matters");
export const createFirmMatter = (input: { referenceAlias: string; documentRole: string; signingProvider: string; signingReference: string; receipt: Receipt }) => request<{ matter: FirmMatter }>("/matters", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input) });
export const saveFinalFirmProof = (matterId: string, receipt: Receipt) => request<{ saved: boolean }>(`/matters/${matterId}/proofs/final`, { method: "POST", body: JSON.stringify({ receipt }) });
