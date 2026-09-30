import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { hashFileLocally } from './lib/hash-file';
import { createUnsignedReceipt, verifyReceiptAgainstDigest } from './lib/proof-core';
import { readProofByQuorum } from './lib/chain';
import { configuredRegistry, connectAndRegister } from './lib/wallet';
import './style.css';

type Receipt = ReturnType<typeof createUnsignedReceipt> & { chain?: { chainId: number; registry: string; transactionHash: string; blockNumber: string; blockHash: string; registrant: string; confirmations: number } };
const formatBytes = (size: number) => size < 1_000_000 ? `${(size / 1_000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(1)} MB`;

function downloadReceipt(receipt: Receipt) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'dagit-proof.json'; anchor.click(); URL.revokeObjectURL(url);
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<{ digest: `0x${string}`; byteLength: number } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState('Choose a file to create a private, local fingerprint.');
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyReceipt, setVerifyReceipt] = useState<Receipt | null>(null);
  const [verifyStatus, setVerifyStatus] = useState('');
  const registry = configuredRegistry();
  const manifest = useMemo(() => hash ? createUnsignedReceipt(hash) : null, [hash]);

  async function hashSelectedFile() {
    if (!file) return;
    setReceipt(null); setHash(null); setProgress(0); setStatus('Hashing original bytes on this device…');
    try {
      const task = hashFileLocally(file, ({ processed, total }) => setProgress(total ? processed / total : 0));
      const result = await task.promise; setHash(result); setStatus('Fingerprint ready. No file bytes were uploaded.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Local hashing failed.'); }
    finally { setProgress(null); }
  }

  async function register() {
    if (!hash || !manifest) return;
    setStatus('Requesting your wallet. DAGIT will send only the digest and receipt-manifest digest.');
    try {
      const result = await connectAndRegister(hash.digest, manifest.manifestDigest);
      const complete: Receipt = { ...manifest, chain: { chainId: 1404, registry: result.registry, transactionHash: result.transactionHash, blockNumber: result.receipt.blockNumber.toString(), blockHash: result.receipt.blockHash, registrant: result.account, confirmations: 1 } };
      setReceipt(complete); setStatus('Proof recorded. Download the receipt or create a QR code to share it deliberately.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Registration did not complete.'); }
  }

  async function verify() {
    if (!verifyFile || !verifyReceipt) return;
    setVerifyStatus('Hashing the selected file locally…');
    try {
      const result = await hashFileLocally(verifyFile, () => {}).promise;
      const local = verifyReceiptAgainstDigest(verifyReceipt, result.digest, result.byteLength);
      if (!local.ok) { setVerifyStatus(`No match: ${local.reason}`); return; }
      if (!verifyReceipt.chain) { setVerifyStatus('Local receipt match. This unsigned receipt has not been registered on chain.'); return; }
      setVerifyStatus('Receipt matches locally. Checking the Chain 1404 quorum…');
      const onChain = await readProofByQuorum(verifyReceipt.chain.registry as `0x${string}`, result.digest);
      if (!onChain.ok) { setVerifyStatus(`Local match, but network verification is unavailable: ${onChain.reason}`); return; }
      if (!onChain.value || onChain.value.manifestDigest !== verifyReceipt.manifestDigest) { setVerifyStatus('No matching on-chain proof was found.'); return; }
      setVerifyStatus(`Verified: exact bytes match a proof recorded by ${onChain.value.registrant} (${onChain.agreeingEndpoints.length} RPC nodes agreed).`);
    } catch (error) { setVerifyStatus(error instanceof Error ? error.message : 'Verification failed.'); }
  }

  return <main>
    <nav><a className="brand" href="#top">DAGIT<span>—</span></a><span>Digital Asset Guarantee &amp; Integrity Tool</span><span className="network">Chain 1404 · BDAG</span></nav>
    <header id="top"><p className="eyebrow">PRIVATE BY DESIGN</p><h1>Prove the file.<br/><em>Not your secrets.</em></h1><p className="lede">DAGIT fingerprints the exact bytes on your device, then lets your own wallet anchor that proof on Chain 1404.</p><div className="pill-row"><span>Nothing uploaded</span><span>No account</span><span>Native BDAG gas</span></div></header>
    <section className="panel" aria-labelledby="register-title"><div className="section-label">01 — REGISTER</div><h2 id="register-title">Create a proof</h2><p>Select a document, image, plan, contract, video, or any other file. We never receive the file or its name.</p>
      <label className="drop"><input type="file" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setHash(null); setReceipt(null); setStatus(next ? `${formatBytes(next.size)} selected locally.` : 'Choose a file to create a private, local fingerprint.'); }}/><strong>{file ? 'File selected on this device' : 'Select a file'}</strong><span>{file ? `${formatBytes(file.size)} · name remains local` : 'Any file type · no upload'}</span></label>
      {file && <button className="primary" onClick={hashSelectedFile} disabled={progress !== null}>{progress === null ? 'Create local fingerprint' : `Hashing ${Math.round(progress * 100)}%`}</button>}
      <p className="status" role="status">{status}</p>
      {hash && manifest && <div className="proof"><div><small>SHA-256 digest</small><code>{hash.digest}</code></div><div><small>Receipt manifest</small><code>{manifest.manifestDigest}</code></div><p>This establishes exact-byte integrity. It does not prove authorship, ownership, legal execution, or the truth of the file.</p>{registry ? <button className="primary" onClick={register}>Register with BDAG wallet</button> : <p className="notice">The production registry is intentionally not configured. The local EVM demo and all proof logic are testable; no mainnet write can occur from this build.</p>}</div>}
      {receipt && <div className="receipt-actions"><button onClick={() => downloadReceipt(receipt)}>Download proof receipt</button><button onClick={async () => { const qr = await QRCode.toDataURL(JSON.stringify(receipt)); const image = window.open(); if (image) image.document.write(`<img alt="DAGIT proof receipt QR" src="${qr}">`); }}>Create share QR</button></div>}
    </section>
    <section className="panel dark" aria-labelledby="verify-title"><div className="section-label">02 — VERIFY</div><h2 id="verify-title">Check an original</h2><p>Choose the original file and its receipt. The file is fingerprinted locally again; changing one byte breaks the match.</p><label className="minor-input">Proof receipt <input type="file" accept="application/json" onChange={async (event) => { const candidate = event.target.files?.[0]; if (!candidate) return; try { setVerifyReceipt(JSON.parse(await candidate.text()) as Receipt); setVerifyStatus('Receipt loaded locally.'); } catch { setVerifyStatus('That file is not a readable DAGIT JSON receipt.'); } }}/></label><label className="minor-input">Original file <input type="file" onChange={(event) => setVerifyFile(event.target.files?.[0] ?? null)}/></label><button className="secondary" onClick={verify} disabled={!verifyFile || !verifyReceipt}>Verify exact bytes</button>{verifyStatus && <p className="status" role="status">{verifyStatus}</p>}</section>
    <footer>Built for integrity evidence, not legal advice. Public-chain proof requires a wallet and network fee in BDAG.</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
