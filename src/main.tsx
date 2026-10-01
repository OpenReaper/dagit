import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { hashFileLocally } from "./lib/hash-file";
import {
  createUnsignedReceipt,
  portableProofFragment,
  receiptFromPortableFragment,
  receiptIsValid,
  verifyReceiptAcknowledgement,
  verifyReceiptAgainstDigest,
  type Receipt,
} from "./lib/proof-core";
import {
  createEvidencePack,
  createMatterRecord,
  matterRecordIsValid,
} from "./lib/matter-core";
import { readProofByQuorum } from "./lib/chain";
import {
  acknowledgeReceipt,
  configuredRegistry,
  connectAndRegister,
  connectWallet,
  DAGIT_UPGRADE_AUTHORITY,
  deployRegistry,
} from "./lib/wallet";
import "./style.css";

type Wallet = { account: string };
type ProofKind = "original" | "revision" | "final" | "evidence";
type IconName =
  | "file"
  | "shield"
  | "wallet"
  | "receipt"
  | "chain"
  | "arrow"
  | "check"
  | "lock"
  | "users"
  | "copy"
  | "print"
  | "link";
type Verification = {
  tone: "idle" | "working" | "fail" | "pass";
  text: string;
  onChain: boolean;
};

const formatBytes = (size: number) =>
  size < 1_000_000
    ? `${(size / 1_000).toFixed(1)} KB`
    : `${(size / 1_000_000).toFixed(1)} MB`;
const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
const kindCopy: Record<ProofKind, string> = {
  original: "Original version",
  revision: "Revision of an earlier proof",
  final: "Final agreed version",
  evidence: "Supporting record",
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    file: (
      <>
        <path d="M7 3.5h6l4 4V20.5H7z" />
        <path d="M13 3.5v4h4M9.5 12h5M9.5 15.5h5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 19 6v5.2c0 4.5-3 7.4-7 9.3-4-1.9-7-4.8-7-9.3V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    wallet: (
      <>
        <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10.5v14H6.5A2.5 2.5 0 0 1 4 16.5v-7A2.5 2.5 0 0 1 6.5 7H19v4H15a2 2 0 0 0 0 4h4v1.5" />
        <path d="M15 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    receipt: (
      <>
        <path d="M7 3.5h10v17l-2.5-1.7-2.5 1.7-2.5-1.7L7 20.5z" />
        <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
      </>
    ),
    chain: (
      <>
        <path d="M9.2 14.8 7.5 16.5a3.2 3.2 0 1 1-4.5-4.5l3-3a3.2 3.2 0 0 1 4.5 0" />
        <path d="m14.8 9.2 1.7-1.7A3.2 3.2 0 1 1 21 12l-3 3a3.2 3.2 0 0 1-4.5 0" />
        <path d="m8.5 15.5 7-7" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h13M13 7l5 5-5 5" />
      </>
    ),
    check: <path d="m7 12.5 3.1 3L17 8.7" />,
    lock: (
      <>
        <rect x="6" y="10" width="12" height="10" rx="2" />
        <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10M12 14v2" />
      </>
    ),
    users: (
      <>
        <path d="M16 19v-1.6a3.7 3.7 0 0 0-3.7-3.7H7.7A3.7 3.7 0 0 0 4 17.4V19" />
        <circle cx="10" cy="7" r="3.2" />
        <path d="M16.5 4.2a3.2 3.2 0 0 1 0 6.2M20 19v-1.5a3.7 3.7 0 0 0-2.3-3.4" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
      </>
    ),
    print: (
      <>
        <path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v6H7z" />
      </>
    ),
    link: (
      <>
        <path d="m10 13.5 4-4" />
        <path d="m7.6 16.4-1.2 1.2a3.3 3.3 0 0 1-4.7-4.7l3-3A3.3 3.3 0 0 1 9.4 9" />
        <path d="m16.4 7.6 1.2-1.2a3.3 3.3 0 0 1 4.7 4.7l-3 3a3.3 3.3 0 0 1-4.7.1" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function downloadReceipt(receipt: Receipt) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dagit-proof-pack.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function proofUrl(receipt: Receipt) {
  return `${window.location.origin}/verify#${portableProofFragment(receipt)}`;
}

async function readReceipt(file: File) {
  const candidate: unknown = JSON.parse(await file.text());
  if (!receiptIsValid(candidate))
    throw new Error("Choose a valid DAGIT proof receipt.");
  return candidate as Receipt;
}

function AdminConsole() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [status, setStatus] = useState(
    "Connect the approved wallet to review the deployment.",
  );
  const [launching, setLaunching] = useState(false);
  const isAuthority =
    wallet?.account.toLowerCase() === DAGIT_UPGRADE_AUTHORITY.toLowerCase();
  async function connectAdminWallet() {
    setStatus("Opening your wallet…");
    try {
      const connected = await connectWallet();
      setWallet(connected);
      setStatus(
        connected.account.toLowerCase() ===
          DAGIT_UPGRADE_AUTHORITY.toLowerCase()
          ? "Approved upgrade-authority wallet connected."
          : `This is not the configured upgrade-authority wallet (${DAGIT_UPGRADE_AUTHORITY}).`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Wallet connection did not complete.",
      );
    }
  }
  async function deploy() {
    setLaunching(true);
    setStatus(
      "Your wallet will show the implementation transaction first, then the proxy transaction. Review both BDAG fees before approving.",
    );
    try {
      const result = await deployRegistry();
      setStatus(
        `Deployment complete. Public proxy: ${result.registry}. Proxy transaction: ${result.transactionHash}. Implementation: ${result.implementation}.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Deployment did not complete.",
      );
    } finally {
      setLaunching(false);
    }
  }
  return (
    <main className="admin-shell">
      <nav className="admin-nav" aria-label="Administration">
        <a className="wordmark" href="/">
          DAGIT
        </a>
        <span>Deployment administration</span>
      </nav>
      <section className="admin-card" aria-labelledby="admin-title">
        <div className="admin-mark">
          <Icon name="lock" size={26} />
          <span>Restricted by Cloudflare Access</span>
        </div>
        <h1 id="admin-title">Deploy the DAGIT registry</h1>
        <p>
          This registry uses an OpenZeppelin UUPS proxy, keeping the public
          address stable while authorized upgrades remain possible.
        </p>
        <dl>
          <div>
            <dt>Upgrade authority</dt>
            <dd>{DAGIT_UPGRADE_AUTHORITY}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>Chain 1404 · BDAG</dd>
          </div>
          <div>
            <dt>What you approve</dt>
            <dd>Implementation, then initialized proxy</dd>
          </div>
        </dl>
        <div className="admin-actions">
          <button
            className="button button-secondary"
            onClick={connectAdminWallet}
          >
            {wallet ? shortAddress(wallet.account) : "Connect wallet"}
          </button>
          <button
            className="button button-primary"
            onClick={deploy}
            disabled={!isAuthority || launching}
          >
            {launching ? "Waiting for wallet…" : "Deploy registry"}
          </button>
        </div>
        <p className="admin-status" role="status">
          {status}
        </p>
        <p className="admin-note">
          DAGIT never receives your private key. Your connected wallet signs
          every transaction and shows the BDAG fee before approval.
        </p>
      </section>
    </main>
  );
}

function ReceiptActions({
  receipt,
  onReceipt,
}: {
  receipt: Receipt;
  onReceipt: (value: Receipt) => void;
}) {
  const [shareStatus, setShareStatus] = useState("");
  const [qr, setQr] = useState("");
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(proofUrl(receipt));
      setShareStatus(
        "Private proof link copied. The receipt is in the URL fragment, not on a DAGIT server.",
      );
    } catch {
      setShareStatus(
        "Your browser did not allow copying. Download the receipt instead.",
      );
    }
  }
  async function createQr() {
    try {
      setQr(
        await QRCode.toDataURL(proofUrl(receipt), {
          margin: 1,
          width: 280,
          errorCorrectionLevel: "M",
        }),
      );
      setShareStatus("Scan this QR with the original file ready to verify.");
    } catch {
      setShareStatus("The QR code could not be created.");
    }
  }
  async function signOwnCopy() {
    try {
      if (receipt.schema !== "dagit-proof/v2")
        throw new Error(
          "Create a new Proof Pack receipt before adding a wallet acknowledgement.",
        );
      setShareStatus("Opening your wallet for a receipt acknowledgement…");
      const acknowledgement = await acknowledgeReceipt(receipt);
      onReceipt({ ...receipt, acknowledgement });
      setShareStatus(
        "Wallet acknowledgement added. Download and share the updated receipt.",
      );
    } catch (error) {
      setShareStatus(
        error instanceof Error
          ? error.message
          : "Wallet acknowledgement did not complete.",
      );
    }
  }
  return (
    <section className="proof-pack" aria-label="Proof Pack">
      <div className="proof-pack-head">
        <span className="success-icon">
          <Icon name="check" size={20} />
        </span>
        <div>
          <strong>Proof ready</strong>
          <p>Send the receipt. Keep the file private.</p>
        </div>
      </div>
      <div className="proof-pack-actions">
        <button
          className="button button-secondary"
          onClick={() => downloadReceipt(receipt)}
        >
          Download receipt
        </button>
        <button className="button button-secondary" onClick={copyLink}>
          <Icon name="copy" size={17} />
          Copy proof link
        </button>
        <button className="button button-primary" onClick={createQr}>
          Create QR <Icon name="arrow" size={17} />
        </button>
      </div>
      <div className="proof-pack-actions subtle">
        <button className="text-button" onClick={() => window.print()}>
          <Icon name="print" size={16} />
          Print certificate
        </button>
      </div>
      {shareStatus && (
        <p className="proof-pack-status" role="status">
          {shareStatus}
        </p>
      )}
      {qr && (
        <div className="qr-panel">
          <img
            src={qr}
            alt="QR code containing a portable DAGIT proof receipt"
          />
          <div>
            <strong>Private proof link</strong>
            <p>
              The QR contains the proof receipt. DAGIT does not host the file or
              receipt.
            </p>
            <button className="text-button" onClick={() => setQr("")}>
              Close QR
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CreateProof({
  wallet,
  connect,
}: {
  wallet: Wallet | null;
  connect: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<{
    digest: `0x${string}`;
    byteLength: number;
  } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState(
    "Choose a file to begin. It stays on this device.",
  );
  const [kind, setKind] = useState<ProofKind>("original");
  const [label, setLabel] = useState("");
  const [parent, setParent] = useState<Receipt | null>(null);
  const [parentStatus, setParentStatus] = useState("");
  const registry = configuredRegistry();
  const manifest = useMemo(
    () =>
      hash
        ? createUnsignedReceipt({
            ...hash,
            record: {
              kind,
              label,
              parent: parent
                ? {
                    digest: parent.hashing.digest,
                    manifestDigest: parent.manifestDigest,
                  }
                : undefined,
            },
          })
        : null,
    [hash, kind, label, parent],
  );
  async function hashSelectedFile() {
    if (!file) return;
    setReceipt(null);
    setHash(null);
    setProgress(0);
    setStatus("Creating your private fingerprint…");
    try {
      const task = hashFileLocally(file, ({ processed, total }) =>
        setProgress(total ? processed / total : 0),
      );
      const result = await task.promise;
      setHash(result);
      setStatus("Fingerprint ready. Your file was not uploaded.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "We could not create a fingerprint for that file.",
      );
    } finally {
      setProgress(null);
    }
  }
  async function chooseParent(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const candidate = await readReceipt(file);
      setParent(candidate);
      setKind((current) => (current === "original" ? "revision" : current));
      setParentStatus("Earlier receipt attached privately to this new proof.");
    } catch (error) {
      setParent(null);
      setParentStatus(
        error instanceof Error
          ? error.message
          : "Earlier receipt could not be used.",
      );
    }
  }
  async function register() {
    if (!hash || !manifest) return;
    setStatus("Your wallet will show the BDAG network fee before you approve.");
    try {
      const result = await connectAndRegister(
        hash.digest,
        manifest.manifestDigest,
      );
      setReceipt({
        ...manifest,
        chain: {
          chainId: 1404,
          registry: result.registry,
          transactionHash: result.transactionHash,
          blockNumber: result.receipt.blockNumber.toString(),
          blockHash: result.receipt.blockHash,
          registrant: result.account,
          confirmations: 1,
        },
      });
      setStatus(
        "Proof recorded. Build the proof pack and give the other person the receipt or QR.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Proof anchoring did not complete.",
      );
    }
  }
  return (
    <section
      className="proof-workspace"
      id="create-proof"
      aria-labelledby="create-title"
    >
      <div className="workspace-head">
        <div>
          <h2 id="create-title">For the firm: record the document version.</h2>
        </div>
        <p>
          The firm records the version it is sending for signature. The client
          receives a receipt or QR, then checks their own copy of the file.
        </p>
      </div>
      <div className="proof-grid">
        <div className="file-panel">
          <div className="panel-top">
            <span className="panel-step">01</span>
            <span>Your private file</span>
          </div>
          <label className={`dropzone ${file ? "selected" : ""}`}>
            <input
              type="file"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setHash(null);
                setReceipt(null);
                setStatus(
                  next
                    ? `${formatBytes(next.size)} selected. It remains on this device.`
                    : "Choose a file to begin. It stays on this device.",
                );
              }}
            />
            <span className="drop-icon">
              <Icon name="file" size={34} />
            </span>
            <strong>
              {file ? "File ready on this device" : "Choose a file"}
            </strong>
            <small>
              {file
                ? `${formatBytes(file.size)} · not uploaded`
                : "Document, photo, plan, video — any file type"}
            </small>
          </label>
          {file && (
            <button
              className="button button-primary"
              onClick={hashSelectedFile}
              disabled={progress !== null}
            >
              {progress === null
                ? "Create private fingerprint"
                : `Creating fingerprint · ${Math.round(progress * 100)}%`}
            </button>
          )}
          <p className="live-status" role="status">
            {status}
          </p>
        </div>
        <div className="proof-context">
          <div className="panel-top">
            <span className="panel-step">02</span>
            <span>Version context</span>
          </div>
          <label>
            Proof type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as ProofKind)}
            >
              <option value="original">Original version</option>
              <option value="revision">Revision</option>
              <option value="final">Final agreed version</option>
              <option value="evidence">Supporting record</option>
            </select>
          </label>
          <label>
            Private label{" "}
            <span>
              Optional. It appears only in the receipt you choose to share.
            </span>
            <input
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Agreement — final review"
            />
          </label>
          <label>
            Earlier receipt{" "}
            <span>
              Optional. It creates a private version link, not a public chain
              relationship.
            </span>
            <input
              type="file"
              accept="application/json"
              onChange={chooseParent}
            />
          </label>
          {parent && (
            <div className="parent-chip">
              <Icon name="link" size={16} />
              <span>Earlier proof attached</span>
              <button
                onClick={() => {
                  setParent(null);
                  setParentStatus("Earlier receipt removed.");
                }}
              >
                Remove
              </button>
            </div>
          )}
          {parentStatus && (
            <p className="field-status" role="status">
              {parentStatus}
            </p>
          )}
        </div>
      </div>
      {hash && manifest && (
        <div className="ready-proof">
          <div className="ready-title">
            <span>
              <Icon name="check" size={20} />
            </span>
            <div>
              <h3>{kindCopy[kind]}</h3>
              <p>This fingerprint matches only this exact file.</p>
            </div>
          </div>
          <code>{hash.digest}</code>
          <div className="anchor-action">
            <span>03 · Anchor with BDAG</span>
            {registry ? (
              <button className="button button-primary" onClick={register}>
                Review in wallet <Icon name="arrow" size={18} />
              </button>
            ) : (
              <p>Registry configuration is not available yet.</p>
            )}
          </div>
        </div>
      )}
      {receipt && <ReceiptActions receipt={receipt} onReceipt={setReceipt} />}
      <div className="wallet-strip">
        <Icon name="wallet" />
        <div>
          <strong>
            {wallet
              ? `Wallet connected: ${shortAddress(wallet.account)}`
              : "Your wallet approves the anchor"}
          </strong>
          <p>
            Pay only the BDAG network fee shown by your wallet. DAGIT takes no
            separate product fee.
          </p>
        </div>
        <button className="button button-light" onClick={() => void connect()}>
          {wallet ? shortAddress(wallet.account) : "Connect wallet"}
        </button>
      </div>
    </section>
  );
}

function FirmMatterWorkspace() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [matterReference, setMatterReference] = useState("");
  const [documentRole, setDocumentRole] = useState("Agreement for signature");
  const [signingProvider, setSigningProvider] = useState("");
  const [signingReference, setSigningReference] = useState("");
  const [preFile, setPreFile] = useState<File | null>(null);
  const [preHash, setPreHash] = useState<{ digest: `0x${string}`; byteLength: number } | null>(null);
  const [preReceipt, setPreReceipt] = useState<Receipt | null>(null);
  const [matter, setMatter] = useState<ReturnType<typeof createMatterRecord> | null>(null);
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [finalHash, setFinalHash] = useState<{ digest: `0x${string}`; byteLength: number } | null>(null);
  const [certificate, setCertificate] = useState<{ digest: `0x${string}`; byteLength: number } | null>(null);
  const [finalReceipt, setFinalReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState("Create the firm’s pre-sign proof first. Files are never uploaded.");
  const [working, setWorking] = useState(false);

  const workflow = { documentRole, signingProvider, signingReference };
  const preManifest = useMemo(() => preHash ? createUnsignedReceipt({ ...preHash, record: { kind: "original", label: documentRole }, workflow }) : null, [preHash, documentRole, signingProvider, signingReference]);
  const finalManifest = useMemo(() => matter && finalHash ? createUnsignedReceipt({ ...finalHash, record: { kind: "final", label: matter.documentRole, parent: { digest: matter.preSignProof.hashing.digest, manifestDigest: matter.preSignProof.manifestDigest } }, workflow: { documentRole: matter.documentRole, signingProvider: matter.signingProvider, signingReference: matter.signingReference } }) : null, [matter, finalHash]);

  async function connect() {
    try { const result = await connectWallet(); setWallet({ account: result.account }); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Wallet connection did not complete."); }
  }
  async function hashFile(file: File, setHash: (value: { digest: `0x${string}`; byteLength: number }) => void, message: string) {
    setWorking(true); setStatus(message);
    try { setHash(await hashFileLocally(file, () => {}).promise); setStatus("Private fingerprint ready. The file never left this browser."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Fingerprinting did not complete."); }
    finally { setWorking(false); }
  }
  async function anchor(manifest: Receipt, hash: { digest: `0x${string}`; byteLength: number }) {
    const result = await connectAndRegister(hash.digest, manifest.manifestDigest);
    return { ...manifest, chain: { chainId: 1404, registry: result.registry, transactionHash: result.transactionHash, blockNumber: result.receipt.blockNumber.toString(), blockHash: result.receipt.blockHash, registrant: result.account, confirmations: 1 } } as Receipt;
  }
  async function recordPreSign() {
    if (!preHash || !preManifest || !matterReference.trim() || !documentRole.trim()) return;
    setWorking(true); setStatus("Your wallet will show the BDAG network fee for the pre-sign proof.");
    try {
      const anchored = await anchor(preManifest, preHash);
      const nextMatter = createMatterRecord({ matterReference, documentRole, signingProvider, signingReference, preSignProof: anchored });
      setPreReceipt(anchored); setMatter(nextMatter); downloadJson(nextMatter, "dagit-firm-matter-record.json");
      setStatus("Pre-sign proof recorded. The local firm matter record downloaded; keep it to link the final signed file.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Pre-sign proof was not recorded."); }
    finally { setWorking(false); }
  }
  async function loadMatter(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const candidate: unknown = JSON.parse(await file.text());
      if (!matterRecordIsValid(candidate)) throw new Error("Choose a valid DAGIT firm matter record.");
      const loaded = candidate as ReturnType<typeof createMatterRecord>;
      setMatter(loaded); setMatterReference(loaded.matterReference); setDocumentRole(loaded.documentRole); setSigningProvider(loaded.signingProvider); setSigningReference(loaded.signingReference); setPreReceipt(loaded.preSignProof);
      setStatus("Firm matter record loaded locally. Choose the completed file to record its final proof.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Matter record could not be loaded."); }
  }
  async function recordFinal() {
    if (!matter || !finalHash || !finalManifest) return;
    setWorking(true); setStatus("Your wallet will show the BDAG network fee for the final proof.");
    try {
      const anchored = await anchor(finalManifest, finalHash); setFinalReceipt(anchored);
      const pack = createEvidencePack({ matter, finalProof: anchored, auditCertificate: certificate ?? undefined });
      downloadJson(pack, "dagit-evidence-pack.json");
      setStatus("Final proof recorded. The evidence pack downloaded with both linked proofs.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Final proof was not recorded."); }
    finally { setWorking(false); }
  }
  return <main className="admin-page firm-page">
    <nav className="site-nav"><a className="wordmark" href="/">DAGIT</a><a className="back-link" href="/">Public site <Icon name="arrow" size={16} /></a></nav>
    <header className="admin-hero"><p className="eyebrow">Firm workspace</p><h1>Prepare, confirm, then retain the proof.</h1><p>This workspace is protected for the firm. It creates local proof records only; use your usual signing service separately.</p></header>
    <section className="firm-workspace">
      <div className="firm-card">
        <div className="panel-top"><span className="panel-step">01</span><span>Pre-sign version</span></div>
        <label>Matter reference <input value={matterReference} maxLength={160} onChange={(e) => setMatterReference(e.target.value)} placeholder="Private firm reference" /></label>
        <label>Document role <input value={documentRole} maxLength={120} onChange={(e) => setDocumentRole(e.target.value)} /></label>
        <label>Signing service <span>Optional. Displayed to the client only after their file matches.</span><input value={signingProvider} maxLength={120} onChange={(e) => setSigningProvider(e.target.value)} placeholder="e.g. your signing service" /></label>
        <label>Signing reference <span>Optional. Never placed on-chain.</span><input value={signingReference} maxLength={120} onChange={(e) => setSigningReference(e.target.value)} /></label>
        <label>Version sent for signing <span>The file stays on this device.</span><input type="file" onChange={(e) => { const selected = e.target.files?.[0] ?? null; setPreFile(selected); setPreHash(null); }} /></label>
        {preFile && <button className="button button-secondary" disabled={working} onClick={() => void hashFile(preFile, setPreHash, "Creating the pre-sign fingerprint…")}>Create fingerprint</button>}
        {preHash && <button className="button button-primary" disabled={working || !configuredRegistry()} onClick={() => void recordPreSign()}>Record pre-sign proof <Icon name="arrow" size={17} /></button>}
        {preReceipt && <ReceiptActions receipt={preReceipt} onReceipt={setPreReceipt} />}
      </div>
      <div className="firm-card">
        <div className="panel-top"><span className="panel-step">02</span><span>Final signed version</span></div>
        <p className="firm-copy">After your signing service completes, record the signed file. DAGIT links it privately to the pre-sign proof and exports the evidence pack.</p>
        <label>Firm matter record <span>Load the local record downloaded in step 1, including after a new browser session.</span><input type="file" accept="application/json" onChange={loadMatter} /></label>
        {matter && <p className="field-status">Matter loaded: {matter.matterReference}</p>}
        <label>Completed signed file <input type="file" disabled={!matter} onChange={(e) => { const selected = e.target.files?.[0] ?? null; setFinalFile(selected); setFinalHash(null); }} /></label>
        {finalFile && <button className="button button-secondary" disabled={working} onClick={() => void hashFile(finalFile, setFinalHash, "Creating the final fingerprint…")}>Create fingerprint</button>}
        <label>Signing audit certificate <span>Optional. DAGIT records only its fingerprint in the evidence pack.</span><input type="file" disabled={!matter} onChange={async (e) => { const selected = e.target.files?.[0]; if (selected) await hashFile(selected, setCertificate, "Fingerprinting audit certificate…"); }} /></label>
        {finalHash && <button className="button button-primary" disabled={working || !configuredRegistry()} onClick={() => void recordFinal()}>Record final proof and export pack <Icon name="arrow" size={17} /></button>}
        {finalReceipt && <ReceiptActions receipt={finalReceipt} onReceipt={setFinalReceipt} />}
      </div>
    </section>
    <div className="wallet-strip"><Icon name="wallet" /><div><strong>{wallet ? `Firm wallet connected: ${shortAddress(wallet.account)}` : "Connect the firm wallet to anchor proofs"}</strong><p>Each proof is approved and paid as a normal BDAG network transaction in the firm’s wallet.</p></div><button className="button button-light" onClick={() => void connect()}>{wallet ? shortAddress(wallet.account) : "Connect wallet"}</button></div>
    <p className="admin-status" role="status">{status}</p>
  </main>;
}

function VerifyProof() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [verification, setVerification] = useState<Verification>({
    tone: "idle",
    text: "Open a proof link or choose a receipt and the original file.",
    onChain: false,
  });
  const [ackStatus, setAckStatus] = useState("");
  useEffect(() => {
    try {
      const imported = receiptFromPortableFragment(window.location.hash);
      if (imported) {
        setReceipt(imported);
        setVerification({
          tone: "idle",
          text: "Proof receipt loaded from the private link. Choose the original file to verify it.",
          onChain: false,
        });
      }
    } catch (error) {
      setVerification({
        tone: "fail",
        text:
          error instanceof Error
            ? error.message
            : "This proof link could not be read.",
        onChain: false,
      });
    }
  }, []);
  async function verify() {
    if (!file || !receipt) return;
    setVerification({
      tone: "working",
      text: "Checking the original file on this device…",
      onChain: false,
    });
    try {
      const result = await hashFileLocally(file, () => {}).promise;
      const local = verifyReceiptAgainstDigest(
        receipt,
        result.digest,
        result.byteLength,
      );
      if (!local.ok)
        return setVerification({
          tone: "fail",
          text: `This file does not match the recorded version. Do not sign this version. ${local.reason}`,
          onChain: false,
        });
      if (!receipt.chain)
        return setVerification({
          tone: "pass",
          text: "The file and receipt match. This receipt has not been anchored on-chain.",
          onChain: false,
        });
      setVerification({
        tone: "working",
        text: "Checking Chain 1404 through the verification quorum…",
        onChain: false,
      });
      const onChain = await readProofByQuorum(
        receipt.chain.registry as `0x${string}`,
        result.digest,
      );
      if (!onChain.ok)
        return setVerification({
          tone: "fail",
          text: `The file and receipt match, but Chain 1404 could not be confirmed: ${onChain.reason}`,
          onChain: false,
        });
      if (
        !onChain.value ||
        onChain.value.manifestDigest.toLowerCase() !==
          receipt.manifestDigest.toLowerCase()
      )
        return setVerification({
          tone: "fail",
          text: "No matching on-chain proof was found.",
          onChain: false,
        });
      if (
        onChain.value.registrant.toLowerCase() !==
        receipt.chain.registrant.toLowerCase()
      )
        return setVerification({
          tone: "fail",
          text: "The receipt registrant does not match the on-chain proof.",
          onChain: false,
        });
      const workflow = "workflow" in receipt ? receipt.workflow : null;
      const nextStep = workflow?.signingProvider
        ? ` Return to your existing ${workflow.signingProvider} signing invitation${workflow.signingReference ? ` (${workflow.signingReference})` : ""}.`
        : " Contact the firm for the signing invitation.";
      setVerification({
        tone: "pass",
        text: `Verified. This exact file matches the version recorded by the firm.${nextStep}`,
        onChain: true,
      });
    } catch (error) {
      setVerification({
        tone: "fail",
        text:
          error instanceof Error
            ? error.message
            : "Verification did not complete.",
        onChain: false,
      });
    }
  }
  async function acknowledge() {
    if (!receipt || !verification.onChain) return;
    try {
      if (receipt.schema !== "dagit-proof/v2")
        throw new Error(
          "Create a new Proof Pack receipt before adding a wallet acknowledgement.",
        );
      setAckStatus("Opening your wallet to acknowledge this exact proof…");
      const acknowledgement = await acknowledgeReceipt(receipt);
      if (
        receipt.chain &&
        acknowledgement.signer.toLowerCase() ===
          receipt.chain.registrant.toLowerCase()
      )
        throw new Error(
          "Use the other party’s wallet for a bilateral acknowledgement.",
        );
      const updated = { ...receipt, acknowledgement };
      setReceipt(updated);
      setAckStatus(
        "Acknowledgement added. Download the updated receipt and return it to the other party.",
      );
    } catch (error) {
      setAckStatus(
        error instanceof Error
          ? error.message
          : "Wallet acknowledgement did not complete.",
      );
    }
  }
  return (
    <main className="verify-page">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="wordmark" href="/">
          DAGIT
        </a>
        <a className="back-link" href="/#create-proof">
          Create a proof <Icon name="arrow" size={16} />
        </a>
      </nav>
      <header className="verify-hero">
        <div>
          <h1>Check the file before you sign.</h1>
          <p>
            DAGIT checks the exact file on your device, then checks the proof
            against Chain 1404. No account. No upload.
          </p>
        </div>
        <div className="verify-steps">
          <span>1</span>
          <p>Open receipt</p>
          <span>2</span>
          <p>Choose original file</p>
          <span>3</span>
          <p>Check before signing</p>
        </div>
      </header>
      <section className="verify-workspace">
        <div className="verify-form">
          <label>
            Proof receipt
            <span>
              {receipt
                ? "Receipt ready. It remains in this browser."
                : "Choose the receipt you received, or open its proof link."}
            </span>
            <input
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const candidate = event.target.files?.[0];
                if (!candidate) return;
                try {
                  setReceipt(await readReceipt(candidate));
                  setVerification({
                    tone: "idle",
                    text: "Receipt ready. Now choose the original file.",
                    onChain: false,
                  });
                } catch (error) {
                  setVerification({
                    tone: "fail",
                    text:
                      error instanceof Error
                        ? error.message
                        : "Choose a valid DAGIT receipt.",
                    onChain: false,
                  });
                }
              }}
            />
          </label>
          <label>
            Original file
            <span>
              Choose the file you received. It is fingerprinted locally.
            </span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="button button-primary"
            onClick={verify}
            disabled={!file || !receipt || verification.tone === "working"}
          >
            {verification.tone === "working"
              ? "Checking proof…"
              : "Check this file"}{" "}
            <Icon name="arrow" size={18} />
          </button>
          <p
            className={`verification-result ${verification.tone}`}
            role="status"
          >
            {verification.text}
          </p>
        </div>
        <aside className="receipt-summary">
          <div className="summary-icon">
            <Icon name="receipt" />
          </div>
          <h2>
            {receipt ? "Proof receipt loaded" : "Your proof stays portable"}
          </h2>
          {receipt ? (
            <>
              <dl>
                <div>
                  <dt>Version</dt>
                  <dd>
                    {"record" in receipt
                      ? kindCopy[receipt.record.kind]
                      : "Legacy proof"}
                  </dd>
                </div>
                <div>
                  <dt>Version link</dt>
                  <dd>
                    {"record" in receipt && receipt.record.parent
                      ? "Earlier proof included"
                      : "None included"}
                  </dd>
                </div>
                <div>
                  <dt>On-chain anchor</dt>
                  <dd>
                    {receipt.chain
                      ? `Chain 1404 · ${shortAddress(receipt.chain.registry)}`
                      : "Not yet anchored"}
                  </dd>
                </div>
                {"workflow" in receipt && receipt.workflow.signingProvider && (
                  <div>
                    <dt>Signing service</dt>
                    <dd>{receipt.workflow.signingProvider}{receipt.workflow.signingReference ? ` · ${receipt.workflow.signingReference}` : ""}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p>
              Portable proof links carry the receipt in the URL fragment. DAGIT
              receives neither the original file nor a proof database record.
            </p>
          )}
        </aside>
      </section>
      <section className="limits">
        <strong>What this confirms</strong>
        <p>
          It confirms that the selected file matches the receipt and its
          on-chain proof. It does not establish authorship, ownership, legal
          execution, identity, or that the file contents are true.
        </p>
      </section>
      <footer>
        <a className="wordmark" href="/">
          DAGIT
        </a>
        <p>One private version. Independently checked.</p>
      </footer>
    </main>
  );
}

function Home() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletStatus, setWalletStatus] = useState("");
  const registry = configuredRegistry();
  async function connect() {
    setWalletStatus("Opening your wallet…");
    try {
      const connected = await connectWallet();
      setWallet(connected);
      setWalletStatus("Wallet connected. You stay in control.");
    } catch (error) {
      setWalletStatus(
        error instanceof Error
          ? error.message
          : "Your wallet could not be connected.",
      );
    }
  }
  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="wordmark" href="#top">
          DAGIT
        </a>
        <span className="product-name">Digital Asset Guarantee &amp; Integrity Tool</span>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="/verify">Verify</a>
        </div>
        <button
          className="button button-primary nav-wallet"
          onClick={() => void connect()}
        >
          {wallet ? shortAddress(wallet.account) : "Firm wallet"}
        </button>
      </nav>
      <header className="hero" id="top">
        <div className="hero-copy">
          <h1>
            One private version.
            <br />
            <span>Two people can prove it.</span>
          </h1>
          <p>
            Send someone a receipt for a document, image or other file. They
            choose their own copy. DAGIT tells you whether both files are
            identical, without either person uploading the file.
          </p>
          <p className="network-attribution">
            Built on BlockDAG Chain 1404 <span>•</span> Proof transactions use BDAG
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#create-proof">
              Prepare a proof <Icon name="arrow" size={18} />
            </a>
            <a className="button button-secondary" href="/verify">
              Verify a received proof
            </a>
          </div>
          {walletStatus && (
            <p className="wallet-status hero-wallet-status" role="status">
              {walletStatus}
            </p>
          )}
        </div>
        <aside className="integrity-card" aria-label="DAGIT proof integrity">
          <div className="integrity-card-head">
            <span className="integrity-emblem">
              <Icon name="users" size={27} />
            </span>
            <span>Shared-version proof</span>
            <i className="status-dot" aria-label="Live registry configured" />
          </div>
          <div className="proof-visual" aria-hidden="true">
            <div className="proof-node">
              <Icon name="file" size={29} />
            </div>
            <span />
            <div className="proof-node">
              <Icon name="receipt" size={27} />
            </div>
            <span />
            <div className="proof-node">
              <Icon name="users" size={29} />
            </div>
          </div>
          <ul className="integrity-list">
            <li>
              <Icon name="check" size={17} />
              <span>Each file stays with its owner</span>
            </li>
            <li>
              <Icon name="check" size={17} />
              <span>Both parties check exact bytes locally</span>
            </li>
            <li>
              <Icon name="check" size={17} />
          <span>Client checks their own copy before signing</span>
            </li>
          </ul>
          <div className="registry-mini">
            <span>Chain 1404</span>
            <strong>
              {registry
                ? `Registry ${shortAddress(registry)}`
                : "Registry status loading"}
            </strong>
          </div>
        </aside>
      </header>
      <section className="trust-rail" aria-label="DAGIT trust commitments">
        <div>
          <Icon name="file" />
          <strong>Your file stays local</strong>
          <span>No file upload</span>
        </div>
        <div>
          <Icon name="users" />
          <strong>Share one version</strong>
          <span>Receipt, link or QR</span>
        </div>
        <div>
          <Icon name="chain" />
          <strong>Anchor when needed</strong>
          <span>Chain 1404 · BDAG</span>
        </div>
        <div>
          <Icon name="shield" />
          <strong>Firm record</strong>
          <span>Chain 1404 proof</span>
        </div>
      </section>
      <section
        className="capabilities"
        id="how-it-works"
        aria-labelledby="capability-title"
      >
        <div className="section-intro">
          <h2 id="capability-title">Check that both people have the same file.</h2>
          <p>
            Create a record for a file. Send the receipt to the other person.
            They check their copy against it. If both files match, they can add
            a copy of the verification result to their matter file.
          </p>
        </div>
        <div className="capability-list">
          <article>
            <span className="capability-icon">
              <Icon name="file" />
            </span>
            <div>
              <h3>Choose a file</h3>
              <p>DAGIT creates a fingerprint on your device. Your file is not uploaded.</p>
            </div>
          </article>
          <article>
            <span className="capability-icon">
              <Icon name="link" />
            </span>
            <div>
              <h3>Send the receipt</h3>
              <p>Share it as a file, QR code or link. The other person does not need a DAGIT account.</p>
            </div>
          </article>
          <article>
            <span className="capability-icon">
              <Icon name="shield" />
            </span>
            <div>
              <h3>Check their copy</h3>
              <p>They select the file they received. DAGIT checks it locally and confirms the Chain 1404 record.</p>
            </div>
          </article>
          <article>
            <span className="capability-icon">
              <Icon name="users" />
            </span>
            <div>
              <h3>Keep the evidence</h3>
              <p>The firm retains the receipt with its existing signing-platform audit record.</p>
            </div>
          </article>
        </div>
      </section>
      <CreateProof wallet={wallet} connect={connect} />
      <section
        className="registry-section"
        id="registry"
        aria-labelledby="registry-title"
      >
        <div>
          <h2 id="registry-title">
            A public record.
            <br />Your file stays private.
          </h2>
          <p>
            The registry holds a fingerprint and manifest commitment. It never
            contains your original file or automatically captures its name or
            metadata.
          </p>
        </div>
        <div className="registry-card">
          <div className="registry-card-title">
            <span>
              <Icon name="chain" />
            </span>
            <div>
              <strong>Chain 1404 registry</strong>
              <small>BDAG network</small>
            </div>
            <i className="status-dot" />
          </div>
          <dl>
            <div>
              <dt>On-chain record</dt>
              <dd>Fingerprint + manifest commitment</dd>
            </div>
            <div>
              <dt>Registry address</dt>
              <dd>{registry ?? "Loading configured registry"}</dd>
            </div>
            <div>
              <dt>Recipient path</dt>
              <dd>Portable receipt → local file check</dd>
            </div>
          </dl>
          <a href="/verify">
            Verify a received proof <Icon name="arrow" size={18} />
          </a>
        </div>
      </section>
      <footer>
        <a className="wordmark" href="#top">
          DAGIT
        </a>
        <span className="footer-product-name">Digital Asset Guarantee &amp; Integrity Tool</span>
        <p>Your file. Your copy. Same version.</p>
        <span>
          Proof records a file fingerprint. It does not establish ownership,
          authorship, legal validity, identity, or truth.
        </span>
      </footer>
    </main>
  );
}

function App() {
  if (window.location.pathname === "/admin/matter") return <FirmMatterWorkspace />;
  if (
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/")
  )
    return <AdminConsole />;
  if (
    window.location.pathname === "/verify" ||
    window.location.pathname.startsWith("/verify/")
  )
    return <VerifyProof />;
  return <Home />;
}
createRoot(document.getElementById("root")!).render(<App />);
