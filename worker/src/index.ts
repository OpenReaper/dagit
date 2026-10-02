import { createRemoteJWKSet, jwtVerify } from "jose";
import { handleOrganisationApi } from "./organisation-api";

type Actor = { memberId: string; firmId: string; email: string; role: string };
type Matter = { id: string; referenceAlias: string; documentRole: string; signingProvider: string; signingReference: string; status: string; createdAt: string; permission: string };

const json = (value: unknown, status = 200, requestId?: string) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-request-id": requestId ?? crypto.randomUUID(), "x-content-type-options": "nosniff" } });
const error = (message: string, status: number, requestId: string) => json({ error: message, requestId }, status, requestId);
const now = () => new Date().toISOString();
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const isDigest = (value: unknown) => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
const asText = (value: unknown, max: number, required = false) => {
  if (typeof value !== "string") { if (required) throw new Error("A required field is missing."); return ""; }
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) throw new Error("A field has an invalid length.");
  return clean;
};
const forbiddenKeys = new Set(["file", "filename", "mime", "content", "bytes", "data", "document"]);
function rejectsDocumentData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(rejectsDocumentData);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => forbiddenKeys.has(key.toLowerCase()) || rejectsDocumentData(child));
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const size = Number(request.headers.get("content-length") ?? "0");
  if (size > 65536) throw new Error("Request is too large.");
  const parsed: unknown = await request.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || rejectsDocumentData(parsed)) throw new Error("Only proof metadata is accepted.");
  return parsed as Record<string, unknown>;
}

async function actor(request: Request, env: Env, requestId: string): Promise<Actor> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Response(JSON.stringify({ error: "Cloudflare Access authentication is required.", requestId }), { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const issuer = env.ACCESS_TEAM_DOMAIN;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!subject || !email) throw new Error("Access identity is incomplete.");
  let member = await env.DB.prepare("SELECT id, firm_id, idp_subject, email, role FROM members WHERE idp_subject = ? AND status = 'active'").bind(subject).first<{ id: string; firm_id: string; idp_subject: string; email: string; role: string }>();
  // Cloudflare One-time PIN can issue a new subject for the same verified email.
  // Access has already verified the JWT and the route policy controls which emails
  // may reach this API, so retain the member record and refresh its provider subject.
  if (!member) {
    member = await env.DB.prepare("SELECT id, firm_id, idp_subject, email, role FROM members WHERE email = ? AND status = 'active'").bind(email).first<{ id: string; firm_id: string; idp_subject: string; email: string; role: string }>();
    if (member && member.idp_subject !== subject) {
      await env.DB.prepare("UPDATE members SET idp_subject = ? WHERE id = ? AND idp_subject = ? AND status = 'active'").bind(subject, member.id, member.idp_subject).run();
      member.idp_subject = subject;
    }
  }
  if (!member && email === env.INITIAL_OWNER_EMAIL.toLowerCase()) {
    const created = now();
    await env.DB.prepare("INSERT INTO firms (id, legal_name, created_at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM firms WHERE legal_name = ?)").bind(crypto.randomUUID(), "Chauncey Law", created, "Chauncey Law").run();
    const firm = await env.DB.prepare("SELECT id FROM firms WHERE legal_name = 'Chauncey Law' LIMIT 1").first<{ id: string }>();
    if (firm) {
      await env.DB.prepare("INSERT OR IGNORE INTO members (id, firm_id, idp_subject, email, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)").bind(crypto.randomUUID(), firm.id, subject, email, created).run();
      member = await env.DB.prepare("SELECT id, firm_id, idp_subject, email, role FROM members WHERE email = ? AND status = 'active'").bind(email).first<{ id: string; firm_id: string; idp_subject: string; email: string; role: string }>();
    }
  }
  if (!member && email === env.INITIAL_OBSERVER_EMAIL.toLowerCase()) {
    const firm = await env.DB.prepare("SELECT id FROM firms WHERE legal_name = 'Chauncey Law' LIMIT 1").first<{ id: string }>();
    if (firm) {
      await env.DB.prepare("INSERT OR IGNORE INTO members (id, firm_id, idp_subject, email, role, created_at) VALUES (?, ?, ?, ?, 'observer', ?)").bind(crypto.randomUUID(), firm.id, subject, email, now()).run();
      member = await env.DB.prepare("SELECT id, firm_id, idp_subject, email, role FROM members WHERE email = ? AND status = 'active'").bind(email).first<{ id: string; firm_id: string; idp_subject: string; email: string; role: string }>();
    }
  }
  if (!member) throw new Error("You are authenticated but are not a member of this firm workspace.");
  return { memberId: member.id, firmId: member.firm_id, email: member.email, role: member.role };
}

async function audit(env: Env, actor: Actor, action: string, requestId: string, matterId?: string) {
  const occurredAt = now();
  const eventId = crypto.randomUUID();
  const eventDigest = await digest(`${eventId}|${actor.firmId}|${matterId ?? ""}|${actor.memberId}|${action}|${occurredAt}|${requestId}`);
  await env.DB.prepare("INSERT INTO audit_events (id, firm_id, matter_id, actor_member_id, action, occurred_at, request_id, event_digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(eventId, actor.firmId, matterId ?? null, actor.memberId, action, occurredAt, requestId, eventDigest).run();
}

async function requireMatter(env: Env, actor: Actor, matterId: string, write = false) {
  const row = await env.DB.prepare("SELECT m.id, m.reference_alias, m.document_role, m.signing_provider, m.signing_reference, m.status, m.created_at, mm.role AS permission FROM matters m JOIN matter_members mm ON mm.matter_id = m.id AND mm.member_id = ? AND mm.revoked_at IS NULL WHERE m.id = ? AND m.firm_id = ?").bind(actor.memberId, matterId, actor.firmId).first<Matter>();
  if (!row) throw new Error("This matter is not available to you.");
  if (write && !["owner", "manager", "contributor"].includes(actor.role) && !["manager", "contributor"].includes(row.permission)) throw new Error("You have read-only access to this matter.");
  return row;
}

function receipt(payload: Record<string, unknown>) {
  const value = payload.receipt;
  if (!value || typeof value !== "object" || Array.isArray(value) || rejectsDocumentData(value)) throw new Error("A valid proof receipt is required.");
  const r = value as Record<string, unknown>; const hashing = r.hashing as Record<string, unknown> | undefined; const chain = r.chain as Record<string, unknown> | undefined;
  if (!hashing || !chain || !isDigest(hashing.digest) || !isDigest(r.manifestDigest) || !isDigest(chain.transactionHash)) throw new Error("Only anchored DAGIT proof receipts can be saved.");
  const serialized = JSON.stringify(value); if (serialized.length > 65536) throw new Error("Proof receipt is too large.");
  return { serialized, digest: hashing.digest as string, manifestDigest: r.manifestDigest as string, tx: chain.transactionHash as string };
}

export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "allow": "GET, POST, OPTIONS", "cache-control": "no-store" } });
    const url = new URL(request.url);
    const organisationResponse = await handleOrganisationApi(request, env, ctx);
    if (organisationResponse) return organisationResponse;
    if (!url.pathname.startsWith("/firm/api/v1/")) return error("Not found.", 404, requestId);
    try {
      const current = await actor(request, env, requestId);
      if (request.method === "GET" && url.pathname === "/firm/api/v1/session") {
        const firm = await env.DB.prepare("SELECT legal_name FROM firms WHERE id = ?").bind(current.firmId).first<{ legal_name: string }>();
        return json({ member: { email: current.email, role: current.role }, firm: { id: current.firmId, name: firm?.legal_name ?? "Firm" } }, 200, requestId);
      }
      if (request.method === "GET" && url.pathname === "/firm/api/v1/matters") {
        const rows = await env.DB.prepare("SELECT m.id, m.reference_alias as referenceAlias, m.document_role as documentRole, m.signing_provider as signingProvider, m.signing_reference as signingReference, m.status, m.created_at as createdAt, mm.role as permission FROM matters m JOIN matter_members mm ON mm.matter_id = m.id AND mm.member_id = ? AND mm.revoked_at IS NULL WHERE m.firm_id = ? ORDER BY m.created_at DESC LIMIT 100").bind(current.memberId, current.firmId).all<Matter>();
        return json({ matters: rows.results }, 200, requestId);
      }
      if (request.method === "POST" && url.pathname === "/firm/api/v1/matters") {
        if (!["owner", "manager", "contributor"].includes(current.role)) return error("Your firm role cannot create matters.", 403, requestId);
        const input = await body(request); const key = request.headers.get("idempotency-key") ?? "";
        if (!/^[A-Za-z0-9_-]{16,200}$/.test(key)) return error("An idempotency key is required.", 400, requestId);
        const existing = await env.DB.prepare("SELECT response_json FROM idempotency_keys WHERE member_id = ? AND key = ?").bind(current.memberId, key).first<{ response_json: string }>();
        if (existing) return json(JSON.parse(existing.response_json), 200, requestId);
        const matter = { id: crypto.randomUUID(), referenceAlias: asText(input.referenceAlias, 160, true), documentRole: asText(input.documentRole, 120, true), signingProvider: asText(input.signingProvider, 120), signingReference: asText(input.signingReference, 120), status: "open", createdAt: now(), permission: "manager" };
        const pre = receipt(input); const proofId = crypto.randomUUID();
        const response = { matter, proof: { id: proofId, stage: "pre-sign" } };
        await env.DB.batch([
          env.DB.prepare("INSERT INTO matters (id, firm_id, reference_alias, document_role, signing_provider, signing_reference, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(matter.id, current.firmId, matter.referenceAlias, matter.documentRole, matter.signingProvider, matter.signingReference, current.memberId, matter.createdAt),
          env.DB.prepare("INSERT INTO matter_members (matter_id, member_id, role, granted_by, granted_at) VALUES (?, ?, 'manager', ?, ?)").bind(matter.id, current.memberId, current.memberId, matter.createdAt),
          env.DB.prepare("INSERT INTO proofs (id, matter_id, stage, receipt_json, digest, manifest_digest, chain_tx, created_by, created_at) VALUES (?, ?, 'pre-sign', ?, ?, ?, ?, ?, ?)").bind(proofId, matter.id, pre.serialized, pre.digest, pre.manifestDigest, pre.tx, current.memberId, matter.createdAt),
          env.DB.prepare("INSERT INTO idempotency_keys (member_id, key, response_json, created_at) VALUES (?, ?, ?, ?)").bind(current.memberId, key, JSON.stringify(response), matter.createdAt),
        ]);
        ctx.waitUntil(audit(env, current, "matter.created", requestId, matter.id));
        return json(response, 201, requestId);
      }
      const finalMatch = url.pathname.match(/^\/firm\/api\/v1\/matters\/([0-9a-f-]{36})\/proofs\/final$/);
      if (request.method === "POST" && finalMatch) {
        const matter = await requireMatter(env, current, finalMatch[1], true); if (matter.status !== "open") return error("This matter is closed.", 409, requestId);
        const input = await body(request); const value = receipt(input);
        const result = await env.DB.prepare("INSERT INTO proofs (id, matter_id, stage, receipt_json, digest, manifest_digest, chain_tx, created_by, created_at) VALUES (?, ?, 'final', ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), matter.id, value.serialized, value.digest, value.manifestDigest, value.tx, current.memberId, now()).run();
        ctx.waitUntil(audit(env, current, "proof.final_saved", requestId, matter.id));
        return json({ saved: true, proofId: result.meta.last_row_id }, 201, requestId);
      }
      return error("Not found.", 404, requestId);
    } catch (cause) {
      if (cause instanceof Response) return cause;
      return error(cause instanceof Error ? cause.message : "Request failed.", 403, requestId);
    }
  },
} satisfies ExportedHandler<Env>;
