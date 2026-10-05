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
import {
  createFirmMatter,
  getFirmSession,
  listFirmMatters,
  saveFinalFirmProof,
  type FirmMatter,
  type FirmSession,
} from "./lib/firm-api";
import { readProofByQuorum } from "./lib/chain";
import {
  acknowledgeReceipt,
  configuredRegistry,
  connectAndRegister,
  connectWallet,
  DAGIT_UPGRADE_AUTHORITY,
  deployRegistry,
  signWorkspaceActivation,
} from "./lib/wallet";
import {
  analyticsConsent,
  initializeTelemetry,
  setAnalyticsConsent,
  track,
} from "./lib/telemetry";
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
  original: "First recorded version",
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
  track("receipt_downloaded");
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
      track("proof_link_copied");
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
      setShareStatus("Scan this QR with your copy ready to check.");
      track("proof_qr_created");
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
        <button className="text-button" onClick={() => { track("certificate_printed"); window.print(); }}>
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
    track("file_hash_started");
    try {
      const task = hashFileLocally(file, ({ processed, total }) =>
        setProgress(total ? processed / total : 0),
      );
      const result = await task.promise;
      setHash(result);
      track("file_hash_completed");
      setStatus("Fingerprint ready. Your file was not uploaded.");
    } catch (error) {
      track("file_hash_failed");
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
    setStatus("Your wallet will show the network fee before you approve.");
    track("proof_anchor_requested");
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
      track("proof_recorded");
    } catch (error) {
      track("proof_anchor_failed");
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
          <h2 id="create-title">Record the version you share.</h2>
        </div>
        <p>
          Choose a file and create a proof receipt. The other person checks
          their own copy, without either of you uploading the file.
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
                if (next) track("proof_started");
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
              <option value="original">First recorded version</option>
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
              placeholder="e.g. Project plan — review copy"
            />
          </label>
          <label>
            Earlier receipt{" "}
            <span>
              Optional. It creates a private version link, not a public
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
            <span>03 · Create proof record</span>
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
            Your wallet shows the network fee before approval. DAGIT takes no
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
  const [firmSession, setFirmSession] = useState<FirmSession | null>(null);
  const [firmMatters, setFirmMatters] = useState<FirmMatter[]>([]);
  const [remoteMatterId, setRemoteMatterId] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState("Connecting to the firm record…");
  const [status, setStatus] = useState("Create the firm’s pre-sign proof first. Files are never uploaded.");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [session, listed] = await Promise.all([getFirmSession(), listFirmMatters()]);
        setFirmSession(session); setFirmMatters(listed.matters);
        setBackendStatus(`Connected to ${session.firm.name}. Shared matter metadata is active; files remain local.`);
      } catch (error) {
        setBackendStatus(error instanceof Error ? error.message : "The firm record is unavailable.");
      }
    })();
  }, []);

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
    setWorking(true); setStatus("Your wallet will show the network fee for the pre-sign proof.");
    try {
      const anchored = await anchor(preManifest, preHash);
      const nextMatter = createMatterRecord({ matterReference, documentRole, signingProvider, signingReference, preSignProof: anchored });
      const remote = await createFirmMatter({ referenceAlias: matterReference, documentRole, signingProvider, signingReference, receipt: anchored });
      setPreReceipt(anchored); setMatter(nextMatter); setRemoteMatterId(remote.matter.id); setFirmMatters((current) => [remote.matter, ...current]); downloadJson(nextMatter, "dagit-firm-matter-record.json");
      setStatus("Pre-sign proof recorded and saved to the shared firm matter. A portable local record also downloaded as a backup.");
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
      setStatus("Portable matter record loaded. Choose the matching shared matter below before saving the final proof.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Matter record could not be loaded."); }
  }
  async function recordFinal() {
    if (!matter || !finalHash || !finalManifest) return;
    setWorking(true); setStatus("Your wallet will show the network fee for the final proof.");
    try {
      const anchored = await anchor(finalManifest, finalHash); setFinalReceipt(anchored);
      const pack = createEvidencePack({ matter, finalProof: anchored, auditCertificate: certificate ?? undefined });
      if (!remoteMatterId) throw new Error("Choose the shared firm matter before saving the final proof.");
      await saveFinalFirmProof(remoteMatterId, anchored);
      downloadJson(pack, "dagit-evidence-pack.json");
      setStatus("Final proof recorded, saved to the shared firm matter, and exported as a local evidence pack.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Final proof was not recorded."); }
    finally { setWorking(false); }
  }
  return <main className="admin-page firm-page">
    <nav className="site-nav"><a className="wordmark" href="/">DAGIT</a><a className="back-link" href="/">Public site <Icon name="arrow" size={16} /></a></nav>
    <header className="admin-hero"><p className="eyebrow">Firm workspace</p><h1>Prepare, confirm, then retain the proof.</h1><p>Matters and proof metadata are shared with the firm. Files, filenames and signing credentials never leave this browser.</p></header>
    <section className="firm-record-status" aria-live="polite"><Icon name="shield" size={18} /><div><strong>{firmSession ? `${firmSession.member.email} · ${firmSession.member.role}` : "Firm record"}</strong><span>{backendStatus}</span></div></section>
    {firmMatters.length > 0 && <section className="firm-matter-list" aria-label="Shared firm matters"><div><strong>Shared matters</strong><span>Choose the matching matter before saving a final proof.</span></div><div className="matter-pills">{firmMatters.map((shared) => <button key={shared.id} className={remoteMatterId === shared.id ? "matter-pill selected" : "matter-pill"} onClick={() => { setRemoteMatterId(shared.id); setMatterReference(shared.referenceAlias); setDocumentRole(shared.documentRole); setSigningProvider(shared.signingProvider); setSigningReference(shared.signingReference); setStatus(`Shared matter selected: ${shared.referenceAlias}.`); }}>{shared.referenceAlias}<small>{shared.status} · {shared.permission}</small></button>)}</div></section>}
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
        {matter && <p className="field-status">Matter loaded: {matter.matterReference}{remoteMatterId ? " · shared firm matter selected" : " · select its shared firm matter above"}</p>}
        <label>Completed signed file <input type="file" disabled={!matter} onChange={(e) => { const selected = e.target.files?.[0] ?? null; setFinalFile(selected); setFinalHash(null); }} /></label>
        {finalFile && <button className="button button-secondary" disabled={working} onClick={() => void hashFile(finalFile, setFinalHash, "Creating the final fingerprint…")}>Create fingerprint</button>}
        <label>Signing audit certificate <span>Optional. DAGIT records only its fingerprint in the evidence pack.</span><input type="file" disabled={!matter} onChange={async (e) => { const selected = e.target.files?.[0]; if (selected) await hashFile(selected, setCertificate, "Fingerprinting audit certificate…"); }} /></label>
        {finalHash && <button className="button button-primary" disabled={working || !configuredRegistry() || !remoteMatterId} onClick={() => void recordFinal()}>Record final proof and export pack <Icon name="arrow" size={17} /></button>}
        {finalReceipt && <ReceiptActions receipt={finalReceipt} onReceipt={setFinalReceipt} />}
      </div>
    </section>
    <div className="wallet-strip"><Icon name="wallet" /><div><strong>{wallet ? `Firm wallet connected: ${shortAddress(wallet.account)}` : "Connect the firm wallet to create proofs"}</strong><p>Each proof is approved in the firm’s wallet. The wallet shows the network fee before approval.</p></div><button className="button button-light" onClick={() => void connect()}>{wallet ? shortAddress(wallet.account) : "Connect wallet"}</button></div>
    <p className="admin-status" role="status">{status}</p>
  </main>;
}

function VerifyProof() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [verification, setVerification] = useState<Verification>({
    tone: "idle",
    text: "Open a proof link or choose a receipt and your copy of the file.",
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
          text: "Proof receipt loaded from the private link. Choose your copy to check it.",
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
    track("verification_started");
    setVerification({
      tone: "working",
      text: "Checking your copy on this device…",
      onChain: false,
    });
    try {
      const result = await hashFileLocally(file, () => {}).promise;
      const local = verifyReceiptAgainstDigest(
        receipt,
        result.digest,
        result.byteLength,
      );
      if (!local.ok) {
        track("verification_mismatched");
        return setVerification({
          tone: "fail",
          text: `This file does not match the recorded version. Do not rely on this version. ${local.reason}`,
          onChain: false,
        });
      }
      if (!receipt.chain) {
        track("verification_matched");
        return setVerification({
          tone: "pass",
          text: "The file and receipt match. This receipt has not been anchored on-chain.",
          onChain: false,
        });
      }
      setVerification({
        tone: "working",
        text: "Checking Chain 1404 through the verification quorum…",
        onChain: false,
      });
      const onChain = await readProofByQuorum(
        receipt.chain.registry as `0x${string}`,
        result.digest,
      );
      if (!onChain.ok) {
        track("verification_chain_unavailable");
        return setVerification({
          tone: "fail",
          text: `The file and receipt match, but Chain 1404 could not be confirmed: ${onChain.reason}`,
          onChain: false,
        });
      }
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
        ? ` Continue with the process you agreed through ${workflow.signingProvider}${workflow.signingReference ? ` (${workflow.signingReference})` : ""}.`
        : " Keep the verified receipt with the version you rely on.";
      setVerification({
        tone: "pass",
        text: `Verified. This exact file matches the recorded version.${nextStep}`,
        onChain: true,
      });
      track("verification_matched");
    } catch (error) {
      track("verification_chain_unavailable");
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
          <h1>Check that your copy matches.</h1>
          <p>
            DAGIT checks the exact file on your device, then checks its proof
            record. No account. No upload.
          </p>
        </div>
        <div className="verify-steps">
          <span>1</span>
          <p>Open receipt</p>
          <span>2</span>
          <p>Choose your copy</p>
          <span>3</span>
          <p>Confirm the match</p>
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
                    text: "Receipt ready. Now choose your copy of the file.",
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
            Your copy
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
            {verification.tone === "pass" && <strong>MATCH</strong>}
            {verification.tone === "fail" && <strong>{verification.text.startsWith("This file does not match") ? "NO MATCH" : "CHECK NOT COMPLETE"}</strong>}
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
                {verification.onChain && "workflow" in receipt && receipt.workflow.signingProvider && (
                  <div>
                    <dt>Related service</dt>
                    <dd>{receipt.workflow.signingProvider}{receipt.workflow.signingReference ? ` · ${receipt.workflow.signingReference}` : ""}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p>
              Portable proof links carry the receipt in the URL fragment. DAGIT
              receives neither your file nor a proof database record.
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
        <a className="footer-link" href="/legal">Legal &amp; privacy</a>
      </footer>
    </main>
  );
}

function Home() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletStatus, setWalletStatus] = useState("");
  async function connect() {
    setWalletStatus("Opening your wallet…");
    track("wallet_connect_requested");
    try {
      const connected = await connectWallet();
      setWallet(connected);
      setWalletStatus("Wallet connected. You stay in control.");
      track("wallet_connected");
    } catch (error) {
      track("wallet_connect_failed");
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
          <a href="/access" onClick={() => track("company_access_selected")}>Company access</a>
          <a href="/register" onClick={() => track("company_registration_selected")}>Register company</a>
        </div>
        <a className="button button-secondary nav-company" href="/access" onClick={() => track("company_access_selected")}>Company</a>
        <button
          className="button button-primary nav-wallet"
          onClick={() => void connect()}
        >
          {wallet ? shortAddress(wallet.account) : "Your wallet"}
        </button>
      </nav>
      <header className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-eyebrow">Private version confirmation</p>
          <h1>
            Know you’re both looking at
            <br />
            <span>the same file.</span>
          </h1>
          <p>
            Create a proof for the version you share. The person receiving it
            checks their own copy — without either of you uploading the file.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#create-proof">
              Create a proof <Icon name="arrow" size={18} />
            </a>
            <a className="button button-secondary" href="/verify">
              Check a received file
            </a>
          </div>
          <p className="hero-reassurance">No file upload · No account needed to check a file</p>
          {walletStatus && (
            <p className="wallet-status hero-wallet-status" role="status">
              {walletStatus}
            </p>
          )}
        </div>
        <aside className="integrity-card" aria-label="How DAGIT confirms a file version">
          <div className="integrity-card-head">
            <span className="integrity-emblem">
              <Icon name="users" size={27} />
            </span>
            <span>How it works</span>
            <i className="status-dot" aria-label="Proof service ready" />
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
              <span>Create a private proof</span>
            </li>
            <li>
              <Icon name="check" size={17} />
              <span>Send the receipt</span>
            </li>
            <li>
              <Icon name="check" size={17} />
              <span>They check their own copy</span>
            </li>
          </ul>
          <div className="registry-mini">
            <span>Private by default</span>
            <strong>Files stay on each person’s device</strong>
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
          <strong>Create a proof record</strong>
          <span>Approved in your wallet</span>
        </div>
        <div>
          <Icon name="shield" />
          <strong>Keep the evidence</strong>
          <span>Save the receipt where you work</span>
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
            They check their copy against it. If both files match, each person
            can keep the receipt with their own records.
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
              <p>They select the file they received. DAGIT checks it locally and confirms the proof record.</p>
            </div>
          </article>
          <article>
            <span className="capability-icon">
              <Icon name="users" />
            </span>
            <div>
              <h3>Keep the evidence</h3>
              <p>Keep the receipt with the records and workflow that matter to you.</p>
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
            A proof record.
            <br />Your file stays private.
          </h2>
          <p>
            DAGIT records a private file fingerprint. It never contains your
            selected file or automatically captures its name or metadata.
          </p>
        </div>
        <div className="registry-card">
          <div className="registry-card-title">
            <span>
              <Icon name="chain" />
            </span>
            <div>
              <strong>DAGIT proof record</strong>
              <small>Independent verification</small>
            </div>
            <i className="status-dot" />
          </div>
          <dl>
            <div>
              <dt>What is recorded</dt>
              <dd>Fingerprint + proof commitment</dd>
            </div>
            <div>
              <dt>What you share</dt>
              <dd>Receipt, link or QR</dd>
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
        <a className="footer-link" href="/legal">Legal &amp; privacy</a>
        <span>
          Proof records a file fingerprint. It does not establish ownership,
          authorship, legal validity, identity, or truth.
        </span>
      </footer>
    </main>
  );
}

function AnalyticsConsent() {
  const [choice, setChoice] = useState<"granted" | "denied" | null>(() => analyticsConsent());
  if (choice) return null;
  return (
    <aside className="analytics-consent" aria-label="Analytics preference">
      <div>
        <strong>Help us improve DAGIT</strong>
        <p>Allow anonymous product-use analytics. We never send file data, filenames, hashes, receipts, wallet addresses, matter references or email addresses.</p>
      </div>
      <div className="analytics-consent-actions">
        <button className="text-button" onClick={() => { setAnalyticsConsent("denied"); setChoice("denied"); }}>No thanks</button>
        <button className="button button-primary" onClick={() => { setAnalyticsConsent("granted"); setChoice("granted"); }}>Allow analytics</button>
      </div>
    </aside>
  );
}

function LegalNotices() {
  return <main className="legal-page">
    <nav className="site-nav" aria-label="Main navigation">
      <a className="wordmark" href="/">DAGIT</a>
      <span className="product-name">Digital Asset Guarantee &amp; Integrity Tool</span>
      <a className="button button-secondary nav-wallet" href="/">Back to DAGIT</a>
    </nav>
    <section className="legal-intro">
      <p className="eyebrow">Legal &amp; privacy · effective 5 October 2026</p>
      <h1>Private by design.</h1>
      <p>DAGIT helps people check whether they have the same private file version. The file stays on each person’s device.</p>
      <p>Need help? Email <a href="mailto:support@macula.co.za">support@macula.co.za</a>.</p>
    </section>
    <section className="legal-grid" aria-label="DAGIT service notices">
      <article>
        <h2>Using DAGIT</h2>
        <p>Use DAGIT only for files you are entitled to use. Check each wallet network and fee prompt before you approve it. Keep your own document, signing and evidence records.</p>
        <p>A proof shows that a fingerprint was recorded. It does not prove who made, sent, received, signed or owns a file.</p>
      </article>
      <article>
        <h2>Your privacy</h2>
        <p>Your selected file stays in your browser. DAGIT does not upload or keep the file, its name or its contents.</p>
        <p>When you approve a proof, its fingerprint, wallet address, transaction and timestamp are recorded on Chain 1404. Public blockchain records cannot generally be deleted.</p>
      </article>
      <article>
        <h2>Receipt wording</h2>
        <p><strong>What a match means:</strong> the selected file matches the fingerprint in the receipt and, where available, its Chain 1404 proof.</p>
        <p><strong>What it does not mean:</strong> it is not proof of who created, signed, sent, received or owns a file, or whether its content is accurate or legally effective.</p>
      </article>
      <article>
        <h2>Your workspace</h2>
        <p>DAGIT does not keep your selected files. Your workspace keeps the details needed to find saved proofs while it is active. The owner can ask us to remove that workspace information by emailing support. We action valid requests within 30 days, except where we need limited information for security, fraud prevention, disputes or law.</p>
      </article>
      <article>
        <h2>Our service partners</h2>
        <p>We use trusted hosting and security partners to run DAGIT. Optional product analytics only run when you allow them. Chain 1404 and your chosen wallet handle the proof you approve.</p>
      </article>
      <article>
        <h2>Incident process</h2>
        <p>For a suspected account, wallet, receipt or product-security problem: stop the affected workflow, preserve the receipt and transaction reference, secure the relevant account or wallet, and contact support. Never email a file, private key, seed phrase, password or signing-provider credential.</p>
      </article>
    </section>
    <footer>
      <a className="wordmark" href="/">DAGIT</a>
      <p>Private version confirmation.</p>
      <span>Digital Asset Guarantee &amp; Integrity Tool</span>
    </footer>
  </main>;
}

function OrganisationRegistration() {
  const [legalName, setLegalName] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setStatus("");
    try {
      track("company_registration_started");
      const connected = await connectWallet();
      const challenge = await fetch("/api/registration/v1/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: connected.account }) });
      const challengeValue: unknown = await challenge.json().catch(() => ({}));
      if (!challenge.ok || !challengeValue || typeof challengeValue !== "object" || !("challengeId" in challengeValue) || !("message" in challengeValue) || typeof challengeValue.challengeId !== "string" || typeof challengeValue.message !== "string") throw new Error(challengeValue && typeof challengeValue === "object" && "error" in challengeValue && typeof challengeValue.error === "string" ? challengeValue.error : "Workspace activation could not start.");
      track("company_wallet_signature_requested");
      const signature = await signWorkspaceActivation(challengeValue.message, connected.account);
      const response = await fetch("/api/registration/v1/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legalName, domain, challengeId: challengeValue.challengeId, signature }) });
      const value: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof value === "object" && value && "error" in value && typeof value.error === "string" ? value.error : "Workspace could not be created.");
      setStatus(typeof value === "object" && value && "message" in value && typeof value.message === "string" ? value.message : "Workspace created and active.");
      track("company_workspace_activated");
    } catch (error) { track("company_registration_failed"); setStatus(error instanceof Error ? error.message : "Workspace could not be created."); } finally { setSending(false); }
  }
  return <main className="register-page"><nav className="site-nav" aria-label="Main navigation"><a className="wordmark" href="/">DAGIT</a><span className="product-name">Digital Asset Guarantee &amp; Integrity Tool</span><a className="button button-secondary nav-wallet" href="/">Back to DAGIT</a></nav><section className="register-card"><p className="eyebrow">Organisation workspace</p><h1>Create your active workspace.</h1><p>Connect the wallet that will own your workspace. DAGIT creates it immediately—there is no approval queue, account password or email check.</p><form onSubmit={submit}><label>Organisation name<input value={legalName} onChange={(event) => setLegalName(event.target.value)} maxLength={160} required /></label><label>Website or work domain <span>(optional)</span><input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="company.com" maxLength={253} /></label><button className="button button-primary" disabled={sending}>{sending ? "Creating workspace…" : "Connect wallet and create workspace"}</button></form>{status && <p className="field-status" role="status">{status}</p>}<small>Your wallet signs one free activation message. No BDAG is spent, no file is uploaded, and no business data is put on-chain. You can create a proof from the main DAGIT page after activation.</small></section></main>;
}

type OwnedWorkspace = { organisationId: string; organisationName: string; workspaceId: string | null; workspaceType: string | null; referenceAlias: string | null; role: string; proofCount?: number; latestProofAt?: string | null };
type WorkspaceProof = { id: string; workspaceId: string; stage: string; digest: string; manifestDigest: string; transactionHash: string; createdAt: string; recordKind?: string | null; parentManifestDigest?: string | null };

function OrganisationAccess() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<OwnedWorkspace[] | null>(null);
  const [proofs, setProofs] = useState<WorkspaceProof[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [savingProof, setSavingProof] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("general");
  const [creatingProject, setCreatingProject] = useState(false);
  async function access() {
    setLoading(true); setStatus("");
    try {
      track("company_access_started");
      const connected = await connectWallet();
      const challenge = await fetch("/api/registration/v1/access/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: connected.account }) });
      const challengeValue: unknown = await challenge.json().catch(() => ({}));
      if (!challenge.ok || !challengeValue || typeof challengeValue !== "object" || !("challengeId" in challengeValue) || !("message" in challengeValue) || typeof challengeValue.challengeId !== "string" || typeof challengeValue.message !== "string") throw new Error(challengeValue && typeof challengeValue === "object" && "error" in challengeValue && typeof challengeValue.error === "string" ? challengeValue.error : "Workspace access could not start.");
      const signature = await signWorkspaceActivation(challengeValue.message, connected.account);
      const response = await fetch("/api/registration/v1/access/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: challengeValue.challengeId, signature }) });
      const value: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof value === "object" && value && "error" in value && typeof value.error === "string" ? value.error : "Workspace access could not be completed.");
      const rows = typeof value === "object" && value && "workspaces" in value && Array.isArray(value.workspaces) ? value.workspaces as OwnedWorkspace[] : [];
      const history = typeof value === "object" && value && "proofs" in value && Array.isArray(value.proofs) ? value.proofs as WorkspaceProof[] : [];
      setWorkspaces(rows); setProofs(history); setWorkspaceId(rows.find((workspace) => workspace.workspaceId)?.workspaceId ?? ""); setStatus(rows.length ? "Your wallet owns the workspace shown below." : "No active workspace belongs to this wallet yet.");
      track(rows.length ? "company_access_completed" : "company_access_empty");
    } catch (error) { track("company_access_failed"); setStatus(error instanceof Error ? error.message : "Workspace access could not be completed."); } finally { setLoading(false); }
  }
  async function saveProof() {
    if (!receipt || !workspaceId) return;
    setSavingProof(true); setStatus("");
    try {
      const connected = await connectWallet();
      const challenge = await fetch("/api/registration/v1/proof/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: connected.account, workspaceId }) });
      const challengeValue: unknown = await challenge.json().catch(() => ({}));
      if (!challenge.ok || !challengeValue || typeof challengeValue !== "object" || !("challengeId" in challengeValue) || !("message" in challengeValue) || typeof challengeValue.challengeId !== "string" || typeof challengeValue.message !== "string") throw new Error(challengeValue && typeof challengeValue === "object" && "error" in challengeValue && typeof challengeValue.error === "string" ? challengeValue.error : "Proof history update could not start.");
      const signature = await signWorkspaceActivation(challengeValue.message, connected.account);
      const response = await fetch("/api/registration/v1/proof/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: challengeValue.challengeId, signature, receipt }) });
      const value: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof value === "object" && value && "error" in value && typeof value.error === "string" ? value.error : "Proof history could not be updated.");
      setStatus(typeof value === "object" && value && "message" in value && typeof value.message === "string" ? value.message : "Proof receipt saved.");
      if (typeof value === "object" && value && "proof" in value && value.proof && typeof value.proof === "object" && "id" in value.proof && typeof value.proof.id === "string") {
        const saved = value.proof as { id: string; workspaceId: string; stage: string; digest: string; manifestDigest: string; transactionHash: string };
        const record = "record" in receipt ? receipt.record : null;
        setProofs((current) => [{ ...saved, createdAt: new Date().toISOString(), recordKind: record?.kind ?? "original", parentManifestDigest: record?.parent?.manifestDigest ?? null }, ...current]);
        setWorkspaces((current) => current?.map((workspace) => workspace.workspaceId === saved.workspaceId ? { ...workspace, proofCount: (workspace.proofCount ?? 0) + 1, latestProofAt: new Date().toISOString() } : workspace) ?? null);
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Proof history could not be updated."); } finally { setSavingProof(false); }
  }
  async function createProject() {
    const organisationId = workspaces?.find((workspace) => workspace.workspaceId)?.organisationId;
    if (!organisationId || !projectName.trim()) return;
    setCreatingProject(true); setStatus("");
    try {
      const connected = await connectWallet();
      const challenge = await fetch("/api/registration/v1/project/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: connected.account, organisationId }) });
      const challengeValue: unknown = await challenge.json().catch(() => ({}));
      if (!challenge.ok || !challengeValue || typeof challengeValue !== "object" || !("challengeId" in challengeValue) || !("message" in challengeValue) || typeof challengeValue.challengeId !== "string" || typeof challengeValue.message !== "string") throw new Error(challengeValue && typeof challengeValue === "object" && "error" in challengeValue && typeof challengeValue.error === "string" ? challengeValue.error : "Workspace creation could not start.");
      const signature = await signWorkspaceActivation(challengeValue.message, connected.account);
      const response = await fetch("/api/registration/v1/project/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: challengeValue.challengeId, signature, referenceAlias: projectName, workspaceType: projectType }) });
      const value: unknown = await response.json().catch(() => ({}));
      if (!response.ok || !value || typeof value !== "object" || !("workspace" in value) || !value.workspace || typeof value.workspace !== "object") throw new Error(value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "Workspace could not be created.");
      const created = value.workspace as { id: string; organisationId: string; referenceAlias: string; type: string; proofCount: number };
      setWorkspaces((current) => [...(current ?? []), { organisationId: created.organisationId, organisationName: workspaces?.find((workspace) => workspace.organisationId === created.organisationId)?.organisationName ?? "Organisation", workspaceId: created.id, workspaceType: created.type, referenceAlias: created.referenceAlias, role: "administrator", proofCount: 0, latestProofAt: null }]);
      setWorkspaceId(created.id); setProjectName(""); setStatus("Workspace created. You can now save proof receipts to it.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Workspace could not be created."); } finally { setCreatingProject(false); }
  }
  return <main className="register-page"><nav className="site-nav" aria-label="Main navigation"><a className="wordmark" href="/">DAGIT</a><span className="product-name">Digital Asset Guarantee &amp; Integrity Tool</span><div className="nav-links"><a href="/register">Register company</a><a href="/verify">Verify</a></div><a className="button button-secondary nav-wallet" href="/">Back to DAGIT</a></nav><section className="register-card access-card"><p className="eyebrow">Company access</p><h1>Open your company workspace.</h1><p>Connect the same wallet used to register your company. DAGIT checks wallet control and shows the active workspaces it owns.</p><button className="button button-primary" onClick={() => void access()} disabled={loading}>{loading ? "Checking workspace…" : "Connect wallet and continue"}</button>{status && <p className="field-status" role="status">{status}</p>}{workspaces && <div className="owned-workspaces" aria-live="polite">{workspaces.map((workspace) => <article key={`${workspace.organisationId}-${workspace.workspaceId ?? "organisation"}`}><strong>{workspace.organisationName}</strong><span>{workspace.referenceAlias ?? "Organisation workspace"} · {workspace.workspaceType ?? "general"} · {workspace.role}</span><small>{workspace.proofCount ?? 0} proof record{workspace.proofCount === 1 ? "" : "s"}{workspace.latestProofAt ? ` · latest ${new Date(workspace.latestProofAt).toLocaleDateString()}` : ""}</small></article>)}</div>}{workspaces && workspaces.length > 0 && <section className="workspace-history"><h2>Projects and proof history</h2><p>Use a separate workspace for a matter, project, property, contractor record or personal file set. Save a proof receipt to find its record later. DAGIT stores receipt metadata, never the file.</p><div className="workspace-create"><label>New workspace<input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={160} placeholder="e.g. North Street contract" /></label><label>Type<select value={projectType} onChange={(event) => setProjectType(event.target.value)}><option value="general">Project</option><option value="legal">Matter</option><option value="contractor">Contractor record</option><option value="property">Property</option><option value="personal">Personal</option></select></label><button className="button button-secondary" onClick={() => void createProject()} disabled={!projectName.trim() || creatingProject}>{creatingProject ? "Creating workspace…" : "Create workspace"}</button></div><label>Proof receipt<input type="file" accept="application/json" onChange={async (event) => { const selected = event.target.files?.[0]; if (!selected) return; try { setReceipt(await readReceipt(selected)); setStatus("Proof receipt ready to save. The file itself was not selected or uploaded."); } catch (error) { setStatus(error instanceof Error ? error.message : "Choose a valid DAGIT proof receipt."); } }} /></label><label>Save to workspace<select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>{workspaces.filter((workspace) => workspace.workspaceId).map((workspace) => <option key={workspace.workspaceId} value={workspace.workspaceId ?? ""}>{workspace.organisationName} · {workspace.referenceAlias ?? "Workspace"}</option>)}</select></label><button className="button button-secondary" onClick={() => void saveProof()} disabled={!receipt || !workspaceId || savingProof}>{savingProof ? "Saving proof history…" : "Save proof receipt"}</button>{proofs.length > 0 ? <div className="proof-history-list">{proofs.map((proof) => <article key={proof.id}><strong>{proof.recordKind ?? proof.stage}</strong><span>Recorded {new Date(proof.createdAt).toLocaleString()} · {shortAddress(proof.transactionHash)}</span>{proof.parentManifestDigest && <small>Linked to an earlier pre-sign proof</small>}</article>)}</div> : <p className="empty-history">No proof receipts saved here yet.</p>}</section>}{workspaces?.length === 0 && <a className="button button-secondary" href="/register">Register a company</a>}<small>This proves wallet control only. It does not send a transaction, upload a file, or verify a company’s real-world identity.</small></section></main>;
}

function App() {
  useEffect(() => initializeTelemetry(), []);
  if (window.location.pathname === "/firm" || window.location.pathname.startsWith("/firm/")) return <FirmMatterWorkspace />;
  if (window.location.pathname === "/admin/matter") return <FirmMatterWorkspace />;
  if (
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/")
  )
    return <AdminConsole />;
  if (
    window.location.pathname === "/verify" ||
    window.location.pathname.startsWith("/verify/")
  ) return <><VerifyProof /><AnalyticsConsent /></>;
  if (window.location.pathname === "/legal") return <LegalNotices />;
  if (window.location.pathname === "/register") return <><OrganisationRegistration /><AnalyticsConsent /></>;
  if (window.location.pathname === "/access") return <><OrganisationAccess /><AnalyticsConsent /></>;
  return <><Home /><AnalyticsConsent /></>;
}
createRoot(document.getElementById("root")!).render(<App />);
