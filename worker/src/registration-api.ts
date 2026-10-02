const now = () => new Date().toISOString();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const blocked = new Set(["file", "filename", "mime", "content", "bytes", "data", "document"]);
const rejectsDocument = (value: unknown): boolean => !value || typeof value !== "object" ? false : Array.isArray(value) ? value.some(rejectsDocument) : Object.entries(value as Record<string, unknown>).some(([key, child]) => blocked.has(key.toLowerCase()) || rejectsDocument(child));
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function handleRegistrationApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url); if (url.pathname !== "/api/registration/v1/start") return null;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0"); if (contentLength > 4096) throw new Error("Registration request is too large.");
    const body: unknown = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body) || rejectsDocument(body)) throw new Error("Only organisation registration details are accepted.");
    const input = body as Record<string, unknown>; const legalName = clean(input.legalName, 160); const domain = clean(input.domain, 253).toLowerCase().replace(/^@/, ""); const email = clean(input.email, 254).toLowerCase();
    if (!legalName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.split("@")[1] !== domain) throw new Error("Use a business name, its email domain, and an administrator email at that domain.");
    const existing = await env.DB.prepare("SELECT id FROM organisation_registration_requests WHERE requested_domain = ? AND administrator_email = ? AND status = 'pending_review' LIMIT 1").bind(domain, email).first<{id:string}>();
    if (existing) return json({ requestId: existing.id, status: "pending_review", message: "This workspace request is already awaiting review." }, 202);
    const id = crypto.randomUUID(); await env.DB.prepare("INSERT INTO organisation_registration_requests (id, legal_name, requested_domain, administrator_email, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, legalName, domain, email, now()).run();
    return json({ requestId: id, status: "pending_review", message: "Workspace request received. DAGIT will verify the organisation before activation." }, 202);
  } catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Registration failed." }, 400); }
}
