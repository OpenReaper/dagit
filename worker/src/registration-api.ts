import { verifyMessage } from "viem";

const now = () => new Date().toISOString();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const blocked = new Set(["file", "filename", "mime", "content", "bytes", "data", "document"]);
const rejectsDocument = (value: unknown): boolean => !value || typeof value !== "object" ? false : Array.isArray(value) ? value.some(rejectsDocument) : Object.entries(value as Record<string, unknown>).some(([key, child]) => blocked.has(key.toLowerCase()) || rejectsDocument(child));
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const wallet = (value: unknown) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : "";
const domain = (value: unknown) => clean(value, 253).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/^@/, "");
const slug = (name: string, suffix: string) => `${name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "workspace"}-${suffix}`.slice(0, 64);
const activationMessage = (id: string, address: string, expiry: string) => `DAGIT workspace activation\nWallet: ${address}\nChallenge: ${id}\nExpires: ${expiry}\n\nThis signature creates an active DAGIT organisation workspace. It does not create a blockchain transaction or publish a file.`;
const accessMessage = (id: string, address: string, expiry: string) => `DAGIT workspace access\nWallet: ${address}\nChallenge: ${id}\nExpires: ${expiry}\n\nThis signature lets DAGIT show workspaces owned by this wallet. It does not create a blockchain transaction or publish a file.`;
const proofHistoryMessage = (id: string, address: string, workspaceId: string, expiry: string) => `DAGIT proof history update\nWallet: ${address}\nWorkspace: ${workspaceId}\nChallenge: ${id}\nExpires: ${expiry}\n\nThis signature saves proof receipt metadata to this workspace. It does not upload a file or create a blockchain transaction.`;
const projectMessage = (id: string, address: string, organisationId: string, expiry: string) => `DAGIT workspace creation\nWallet: ${address}\nOrganisation: ${organisationId}\nChallenge: ${id}\nExpires: ${expiry}\n\nThis signature creates a workspace for this organisation. It does not create a blockchain transaction or publish a file.`;
const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const isDigest = (value: unknown) => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
const proofReceipt = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || rejectsDocument(value)) throw new Error("Choose a valid DAGIT proof receipt.");
  const receipt = value as Record<string, unknown>; const hashing = receipt.hashing as Record<string, unknown> | undefined; const chain = receipt.chain as Record<string, unknown> | undefined; const record = receipt.record as Record<string, unknown> | undefined;
  if (!hashing || !chain || !isDigest(hashing.digest) || !isDigest(receipt.manifestDigest) || !isDigest(chain.transactionHash)) throw new Error("Only anchored DAGIT proof receipts can be saved to a workspace.");
  const kind = record && typeof record.kind === "string" ? record.kind : "original";
  const stage = kind === "revision" ? "revision" : kind === "final" ? "final" : kind === "evidence" ? "inspection" : "recorded";
  const serialised = JSON.stringify(receipt); if (serialised.length > 65536) throw new Error("Proof receipt is too large.");
  return { serialised, digest: hashing.digest as string, manifestDigest: receipt.manifestDigest as string, chainTx: chain.transactionHash as string, stage };
};

async function input(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 65536) throw new Error("Registration request is too large.");
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body) || rejectsDocument(body)) throw new Error("Only organisation registration details are accepted.");
  return body as Record<string, unknown>;
}

export async function handleRegistrationApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/registration/v1/")) return null;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    if (url.pathname === "/api/registration/v1/challenge" || url.pathname === "/api/registration/v1/access/challenge" || url.pathname === "/api/registration/v1/proof/challenge" || url.pathname === "/api/registration/v1/project/challenge") {
      const body = await input(request); const address = wallet(body.wallet);
      if (!address) throw new Error("Connect a valid wallet address.");
      const id = crypto.randomUUID(); const createdAt = now(); const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const workspaceId = clean(body.workspaceId, 36);
      const organisationId = clean(body.organisationId, 36);
      if (url.pathname === "/api/registration/v1/proof/challenge" && !isUuid(workspaceId)) throw new Error("Choose a valid workspace.");
      if (url.pathname === "/api/registration/v1/project/challenge" && !isUuid(organisationId)) throw new Error("Choose a valid organisation.");
      const message = url.pathname === "/api/registration/v1/access/challenge" ? accessMessage(id, address, expiresAt) : url.pathname === "/api/registration/v1/proof/challenge" ? proofHistoryMessage(id, address, workspaceId, expiresAt) : url.pathname === "/api/registration/v1/project/challenge" ? projectMessage(id, address, organisationId, expiresAt) : activationMessage(id, address, expiresAt);
      await env.DB.prepare("INSERT INTO organisation_wallet_registration_challenges (id, wallet_address, message, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, address, message, expiresAt, createdAt).run();
      return json({ challengeId: id, message, expiresAt });
    }
    const isAccess = url.pathname === "/api/registration/v1/access/complete";
    const isProofSave = url.pathname === "/api/registration/v1/proof/complete";
    const isProjectCreate = url.pathname === "/api/registration/v1/project/complete";
    if (url.pathname !== "/api/registration/v1/complete" && !isAccess && !isProofSave && !isProjectCreate) return json({ error: "Not found." }, 404);
    const body = await input(request); const challengeId = clean(body.challengeId, 36); const signature = clean(body.signature, 132); const legalName = clean(body.legalName, 160); const requestedDomain = domain(body.domain);
    if (!isUuid(challengeId) || !/^0x[0-9a-fA-F]{130}$/.test(signature) || (!isAccess && !isProofSave && !isProjectCreate && !legalName)) throw new Error(isAccess || isProofSave || isProjectCreate ? "Provide a valid wallet signature." : "Provide an organisation name and a valid wallet signature.");
    if (requestedDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(requestedDomain)) throw new Error("Enter a valid website or work domain, or leave it blank.");
    const challenge = await env.DB.prepare("SELECT id, wallet_address as walletAddress, message, expires_at as expiresAt, used_at as usedAt FROM organisation_wallet_registration_challenges WHERE id = ?").bind(challengeId).first<{id:string;walletAddress:string;message:string;expiresAt:string;usedAt:string|null}>();
    if (!challenge || challenge.usedAt || Date.parse(challenge.expiresAt) < Date.now()) throw new Error("This wallet signature request has expired. Start again.");
    const valid = await verifyMessage({ address: challenge.walletAddress as `0x${string}`, message: challenge.message, signature: signature as `0x${string}` });
    if (!valid) throw new Error("The signature does not match the connected wallet.");
    if (isProjectCreate) {
      const match = challenge.message.match(/^DAGIT workspace creation\nWallet: (0x[0-9a-f]{40})\nOrganisation: ([0-9a-f-]{36})\nChallenge:/i);
      const referenceAlias = clean(body.referenceAlias, 160); const workspaceType = clean(body.workspaceType, 32);
      if (!match || match[1].toLowerCase() !== challenge.walletAddress || !isUuid(match[2]) || !referenceAlias || !["general", "legal", "contractor", "property", "personal"].includes(workspaceType)) throw new Error("Provide a workspace name and type.");
      const owner = await env.DB.prepare("SELECT i.id as identityId FROM identities i JOIN organisation_memberships om ON om.identity_id = i.id AND om.status = 'active' WHERE i.idp_subject = ? AND om.organisation_id = ? AND om.role = 'administrator'").bind(`wallet:${challenge.walletAddress}`, match[2]).first<{identityId:string}>();
      if (!owner) throw new Error("This wallet cannot create a workspace for that organisation.");
      const workspaceId = crypto.randomUUID(); const createdAt = now();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO workspaces (id, organisation_id, workspace_type, reference_alias, status, created_by, created_at) VALUES (?, ?, ?, ?, 'open', ?, ?)").bind(workspaceId, match[2], workspaceType, referenceAlias, owner.identityId, createdAt),
        env.DB.prepare("INSERT INTO workspace_memberships (workspace_id, identity_id, role, granted_by, granted_at) VALUES (?, ?, 'manager', ?, ?)").bind(workspaceId, owner.identityId, owner.identityId, createdAt),
        env.DB.prepare("UPDATE organisation_wallet_registration_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(createdAt, challenge.id),
      ]);
      return json({ workspace: { id: workspaceId, organisationId: match[2], referenceAlias, type: workspaceType, proofCount: 0 }, message: "Workspace created. You can now save proof receipts to it." }, 201);
    }
    if (isProofSave) {
      const match = challenge.message.match(/^DAGIT proof history update\nWallet: (0x[0-9a-f]{40})\nWorkspace: ([0-9a-f-]{36})\nChallenge:/i);
      if (!match || match[1].toLowerCase() !== challenge.walletAddress || !isUuid(match[2])) throw new Error("This signature request is not valid for proof history.");
      const owner = await env.DB.prepare("SELECT i.id as identityId FROM identities i JOIN workspace_memberships wm ON wm.identity_id = i.id AND wm.revoked_at IS NULL WHERE i.idp_subject = ? AND wm.workspace_id = ? AND wm.role = 'manager'").bind(`wallet:${challenge.walletAddress}`, match[2]).first<{identityId:string}>();
      if (!owner) throw new Error("This wallet cannot update that workspace.");
      const proof = proofReceipt(body.receipt); const createdAt = now(); const proofId = crypto.randomUUID();
      const result = await env.DB.batch([
        env.DB.prepare("INSERT OR IGNORE INTO workspace_proofs (id, workspace_id, stage, receipt_json, digest, manifest_digest, chain_tx, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(proofId, match[2], proof.stage, proof.serialised, proof.digest, proof.manifestDigest, proof.chainTx, owner.identityId, createdAt),
        env.DB.prepare("UPDATE organisation_wallet_registration_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(createdAt, challenge.id),
      ]);
      const saved = (result[0].meta.changes ?? 0) > 0;
      return json({ saved, proof: { id: saved ? proofId : null, workspaceId: match[2], stage: proof.stage, digest: proof.digest, manifestDigest: proof.manifestDigest, transactionHash: proof.chainTx }, message: saved ? "Proof receipt metadata saved to this workspace. The file was never uploaded." : "This proof is already in this workspace." }, saved ? 201 : 200);
    }
    if (isAccess) {
      if (!challenge.message.startsWith("DAGIT workspace access\n")) throw new Error("This signature request is for workspace activation, not access.");
      const workspaces = await env.DB.prepare("SELECT o.id as organisationId, o.legal_name as organisationName, o.status as organisationStatus, w.id as workspaceId, w.workspace_type as workspaceType, w.reference_alias as referenceAlias, w.status as workspaceStatus, om.role, (SELECT count(*) FROM workspace_proofs p WHERE p.workspace_id = w.id) as proofCount, (SELECT max(p.created_at) FROM workspace_proofs p WHERE p.workspace_id = w.id) as latestProofAt FROM identities i JOIN organisation_memberships om ON om.identity_id = i.id AND om.status = 'active' JOIN organisations o ON o.id = om.organisation_id AND o.status = 'active' LEFT JOIN workspaces w ON w.organisation_id = o.id AND w.status != 'deleted' WHERE i.idp_subject = ? ORDER BY o.created_at DESC, w.created_at ASC LIMIT 100").bind(`wallet:${challenge.walletAddress}`).all();
      const proofs = await env.DB.prepare("SELECT p.id, p.workspace_id as workspaceId, p.stage, p.digest, p.manifest_digest as manifestDigest, p.chain_tx as transactionHash, p.created_at as createdAt, json_extract(p.receipt_json, '$.record.kind') as recordKind, json_extract(p.receipt_json, '$.record.parent.manifestDigest') as parentManifestDigest FROM workspace_proofs p JOIN workspace_memberships wm ON wm.workspace_id = p.workspace_id AND wm.revoked_at IS NULL JOIN identities i ON i.id = wm.identity_id WHERE i.idp_subject = ? ORDER BY p.created_at DESC LIMIT 200").bind(`wallet:${challenge.walletAddress}`).all();
      await env.DB.prepare("UPDATE organisation_wallet_registration_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(now(), challenge.id).run();
      return json({ ownerWallet: challenge.walletAddress, workspaces: workspaces.results, proofs: proofs.results });
    }
    if (!challenge.message.startsWith("DAGIT workspace activation\n")) throw new Error("This signature request is for workspace access, not activation.");
    const existing = await env.DB.prepare("SELECT o.id, o.legal_name as legalName, w.id as workspaceId FROM identities i JOIN organisation_memberships om ON om.identity_id = i.id AND om.status = 'active' JOIN organisations o ON o.id = om.organisation_id AND o.status = 'active' LEFT JOIN workspaces w ON w.organisation_id = o.id AND w.status = 'open' WHERE i.idp_subject = ? AND lower(o.legal_name) = lower(?) ORDER BY w.created_at ASC LIMIT 1").bind(`wallet:${challenge.walletAddress}`, legalName).first<{id:string;legalName:string;workspaceId:string|null}>();
    if (existing) {
      await env.DB.prepare("UPDATE organisation_wallet_registration_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(now(), challenge.id).run();
      return json({ organisation: { id: existing.id, name: existing.legalName, status: "active" }, workspace: { id: existing.workspaceId, type: "general" }, ownerWallet: challenge.walletAddress, message: "This wallet already owns an active workspace for this organisation." });
    }
    const createdAt = now(); const identitySubject = `wallet:${challenge.walletAddress}`; const internalEmail = `wallet+${challenge.walletAddress.slice(2)}@wallet.dagit.invalid`;
    await env.DB.prepare("INSERT OR IGNORE INTO identities (id, idp_subject, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), identitySubject, internalEmail, createdAt, createdAt).run();
    const owner = await env.DB.prepare("SELECT id FROM identities WHERE idp_subject = ?").bind(identitySubject).first<{id:string}>();
    if (!owner) throw new Error("The wallet owner could not be created.");
    const organisationId = crypto.randomUUID(); const workspaceId = crypto.randomUUID(); const organisationSlug = slug(legalName, organisationId.replace(/-/g, "").slice(0, 10));
    const statements = [
      env.DB.prepare("INSERT INTO organisations (id, legal_name, slug, status, plan_code, created_at) VALUES (?, ?, ?, 'active', 'pilot', ?)").bind(organisationId, legalName, organisationSlug, createdAt),
      env.DB.prepare("INSERT INTO organisation_memberships (organisation_id, identity_id, role, status, created_at) VALUES (?, ?, 'administrator', 'active', ?)").bind(organisationId, owner.id, createdAt),
      env.DB.prepare("INSERT INTO workspaces (id, organisation_id, workspace_type, reference_alias, status, created_by, created_at) VALUES (?, ?, 'general', 'Workspace', 'open', ?, ?)").bind(workspaceId, organisationId, owner.id, createdAt),
      env.DB.prepare("INSERT INTO workspace_memberships (workspace_id, identity_id, role, granted_by, granted_at) VALUES (?, ?, 'manager', ?, ?)").bind(workspaceId, owner.id, owner.id, createdAt),
      env.DB.prepare("UPDATE organisation_wallet_registration_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(createdAt, challenge.id),
    ];
    if (requestedDomain) statements.splice(1, 0, env.DB.prepare("INSERT INTO organisation_domains (organisation_id, domain) VALUES (?, ?)").bind(organisationId, requestedDomain));
    await env.DB.batch(statements);
    return json({ organisation: { id: organisationId, name: legalName, status: "active" }, workspace: { id: workspaceId, type: "general" }, ownerWallet: challenge.walletAddress, message: "Workspace created and active. This wallet is its owner." }, 201);
  } catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Registration failed." }, 400); }
}
