import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { hashFileLocally } from './lib/hash-file';
import { createUnsignedReceipt, verifyReceiptAgainstDigest } from './lib/proof-core';
import { readProofByQuorum } from './lib/chain';
import { configuredRegistry, connectAndRegister, connectWallet } from './lib/wallet';
import './style.css';

type Receipt = ReturnType<typeof createUnsignedReceipt> & { chain?: { chainId: number; registry: string; transactionHash: string; blockNumber: string; blockHash: string; registrant: string; confirmations: number } };
type Wallet = { account: string };
const formatBytes = (size: number) => size < 1_000_000 ? `${(size / 1_000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(1)} MB`;
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function downloadReceipt(receipt: Receipt) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'dagit-proof.json'; anchor.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<{ digest: `0x${string}`; byteLength: number } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [status, setStatus] = useState('Choose a file to begin. It stays on this device.');
  const [walletStatus, setWalletStatus] = useState('');
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyReceipt, setVerifyReceipt] = useState<Receipt | null>(null);
  const [verifyStatus, setVerifyStatus] = useState('');
  const registry = configuredRegistry();
  const manifest = useMemo(() => hash ? createUnsignedReceipt(hash) : null, [hash]);

  async function hashSelectedFile() {
    if (!file) return;
    setReceipt(null); setHash(null); setProgress(0); setStatus('Creating a private fingerprint…');
    try {
      const task = hashFileLocally(file, ({ processed, total }) => setProgress(total ? processed / total : 0));
      const result = await task.promise;
      setHash(result); setStatus('Your fingerprint is ready. Your file was not uploaded.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'We could not create a fingerprint for that file.'); }
    finally { setProgress(null); }
  }

  async function connect() {
    setWalletStatus('Opening your wallet…');
    try {
      const connected = await connectWallet();
      setWallet(connected); setWalletStatus('Wallet connected. You stay in control.');
    } catch (error) { setWalletStatus(error instanceof Error ? error.message : 'Your wallet could not be connected.'); }
  }

  async function register() {
    if (!hash || !manifest) return;
    setStatus('Your wallet will show the BDAG network fee before you approve.');
    try {
      const result = await connectAndRegister(hash.digest, manifest.manifestDigest);
      const complete: Receipt = { ...manifest, chain: { chainId: 1404, registry: result.registry, transactionHash: result.transactionHash, blockNumber: result.receipt.blockNumber.toString(), blockHash: result.receipt.blockHash, registrant: result.account, confirmations: 1 } };
      setReceipt(complete); setStatus('Proof recorded. Save your receipt somewhere safe.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Proof anchoring did not complete.'); }
  }

  async function verify() {
    if (!verifyFile || !verifyReceipt) return;
    setVerifyStatus('Checking the original file on this device…');
    try {
      const result = await hashFileLocally(verifyFile, () => {}).promise;
      const local = verifyReceiptAgainstDigest(verifyReceipt, result.digest, result.byteLength);
      if (!local.ok) { setVerifyStatus(`No match: ${local.reason}`); return; }
      if (!verifyReceipt.chain) { setVerifyStatus('The file and receipt match. This receipt has not been anchored on-chain.'); return; }
      setVerifyStatus('Checking Chain 1404…');
      const onChain = await readProofByQuorum(verifyReceipt.chain.registry as `0x${string}`, result.digest);
      if (!onChain.ok) { setVerifyStatus(`The file and receipt match, but Chain 1404 is unavailable: ${onChain.reason}`); return; }
      if (!onChain.value || onChain.value.manifestDigest !== verifyReceipt.manifestDigest) { setVerifyStatus('No matching on-chain proof was found.'); return; }
      setVerifyStatus('Verified. This exact file matches the saved on-chain proof.');
    } catch (error) { setVerifyStatus(error instanceof Error ? error.message : 'Verification did not complete.'); }
  }

  return <main>
    <nav aria-label="Main navigation">
      <a className="brand" href="#top">DAGIT</a>
      <div className="nav-links"><a href="#how-it-works">How it works</a><a href="#verify">Verify a file</a></div>
      <button className="wallet-button" onClick={connect}>{wallet ? shortAddress(wallet.account) : 'Connect wallet'}</button>
    </nav>

    <header id="top">
      <div className="hero-copy"><p className="overline">CHAIN 1404 · BDAG</p><h1>Proof for the files<br/><em>that matter.</em></h1><p>Create a private fingerprint of any file. When proof anchoring is live, approve the Chain 1404 transaction in your own wallet.</p><a className="text-link" href="#create-proof">Create a proof <span>↓</span></a></div>
      <aside className="trust-card"><span className="lock-mark" aria-hidden="true">⌁</span><h2>Private by default</h2><p>Your file stays on your device. DAGIT never asks for your seed phrase or takes custody of your BDAG.</p><ul><li>No account</li><li>No file upload</li><li>No DAGIT payment</li></ul></aside>
    </header>

    <section className="steps" id="how-it-works" aria-label="How DAGIT works"><div><span>1</span><h2>Choose a file</h2><p>We create its fingerprint on your device.</p></div><div><span>2</span><h2>Connect your wallet</h2><p>You approve every action yourself.</p></div><div><span>3</span><h2>Save your receipt</h2><p>Use it later to check the exact file.</p></div></section>

    <section className="proof-workspace" id="create-proof" aria-labelledby="create-title">
      <div className="workspace-title"><p className="overline">CREATE A PROOF</p><h2 id="create-title">Start with your file</h2><p>Choose a file, create its private fingerprint, then connect your self-custody wallet.</p></div>
      <div className="proof-grid">
        <div className="file-panel">
          <label className={`dropzone ${file ? 'selected' : ''}`}><input type="file" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setHash(null); setReceipt(null); setStatus(next ? `${formatBytes(next.size)} selected. It remains on this device.` : 'Choose a file to begin. It stays on this device.'); }}/><span className="file-symbol" aria-hidden="true">+</span><strong>{file ? 'File ready on this device' : 'Choose a file'}</strong><small>{file ? `${formatBytes(file.size)} · not uploaded` : 'Document, photo, plan, video — any file type'}</small></label>
          {file && <button className="primary-action" onClick={hashSelectedFile} disabled={progress !== null}>{progress === null ? 'Create private fingerprint' : `Creating fingerprint · ${Math.round(progress * 100)}%`}</button>}
          <p className="live-status" role="status">{status}</p>
        </div>
        <div className="wallet-panel">
          <p className="panel-label">YOUR WALLET</p><h3>{wallet ? 'Wallet connected' : 'Connect when you are ready'}</h3><p>{wallet ? `Using ${shortAddress(wallet.account)} on Chain 1404.` : 'Use a compatible self-custody wallet. You keep your private keys and approve every transaction.'}</p>
          <button className="secondary-action" onClick={connect}>{wallet ? 'Wallet connected' : 'Connect wallet'}</button>
          {walletStatus && <p className="wallet-status" role="status">{walletStatus}</p>}
          <div className="fee-note"><span>What you pay</span><strong>BDAG network fee</strong><p>DAGIT takes no payment. Your wallet shows the final network fee before you approve.</p></div>
        </div>
      </div>
      {hash && manifest && <div className="ready-proof"><div><span className="check" aria-hidden="true">✓</span><div><h3>Fingerprint ready</h3><p>This fingerprint matches only this exact file.</p></div></div><code>{hash.digest}</code><div className="anchor-action">{registry ? <button className="primary-action" onClick={register}>Review in wallet</button> : <div><strong>On-chain proof is not live in this demo.</strong><p>When live, your wallet will show the BDAG network fee before you approve.</p></div>}</div></div>}
      {receipt && <div className="receipt-actions"><button onClick={() => downloadReceipt(receipt)}>Download receipt</button><button onClick={async () => { const qr = await QRCode.toDataURL(JSON.stringify(receipt)); const image = window.open(); if (image) image.document.write('<img alt="DAGIT proof receipt QR" src="' + qr + '">'); }}>Create QR</button></div>}
    </section>

    <section className="verify-section" id="verify" aria-labelledby="verify-title"><div><p className="overline">VERIFY A FILE</p><h2 id="verify-title">Check the original,<br/>any time.</h2><p>Choose the original file and its DAGIT receipt. A changed file will not match.</p></div><div className="verify-form"><label>Proof receipt<input type="file" accept="application/json" onChange={async (event) => { const candidate = event.target.files?.[0]; if (!candidate) return; try { setVerifyReceipt(JSON.parse(await candidate.text()) as Receipt); setVerifyStatus('Receipt ready. Now choose the original file.'); } catch { setVerifyStatus('Choose a valid DAGIT receipt file.'); } }}/></label><label>Original file<input type="file" onChange={(event) => setVerifyFile(event.target.files?.[0] ?? null)}/></label><button className="light-action" onClick={verify} disabled={!verifyFile || !verifyReceipt}>Verify file</button>{verifyStatus && <p className="verify-status" role="status">{verifyStatus}</p>}</div></section>

    <footer><a className="brand" href="#top">DAGIT</a><p>Your file. Your wallet. Your proof.</p><span>Proof records a file fingerprint. It does not establish ownership or authorship.</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
