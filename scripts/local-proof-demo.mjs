import fs from 'node:fs';
import path from 'node:path';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom } from 'viem';
import { createUnsignedReceipt, digestBytes, verifyReceiptAgainstDigest } from '../src/lib/proof-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'DAGITRegistry.json'), 'utf8'));
const proxyArtifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'DAGITRegistryProxy.json'), 'utf8'));
const localChain = { id: 1404, name: 'BlockDAG Local Test', nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1'] } } };
const bytes = new TextEncoder().encode('DAGIT local vertical proof fixture\n');
const digest = digestBytes(bytes);
const receiptDraft = createUnsignedReceipt({ digest, byteLength: bytes.byteLength });
// Paris-targeted bytecode is exercised on the local EVM; Ganache does not expose a `paris` hardfork label.
const server = ganache.server({ chain: { chainId: 1404 }, logging: { quiet: true } });
await server.listen(0, '127.0.0.1');
try {
  const provider = server.provider;
  const [account] = await provider.request({ method: 'eth_accounts' });
  const wallet = createWalletClient({ chain: localChain, transport: custom(provider) });
  const client = createPublicClient({ chain: localChain, transport: custom(provider) });
  const deploymentHash = await wallet.deployContract({ account, abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, gas: 1_000_000n });
  const deployment = await client.getTransactionReceipt({ hash: deploymentHash });
  const proxyHash = await wallet.deployContract({ account, abi: proxyArtifact.abi, bytecode: `0x${proxyArtifact.evm.bytecode.object}`, args: [deployment.contractAddress, account], gas: 1_000_000n });
  const proxy = await client.getTransactionReceipt({ hash: proxyHash });
  const txHash = await wallet.writeContract({ account, address: proxy.contractAddress, abi: artifact.abi, functionName: 'register', args: [digest, receiptDraft.manifestDigest], gas: 300_000n });
  const tx = await client.getTransactionReceipt({ hash: txHash });
  const proof = await client.readContract({ address: proxy.contractAddress, abi: artifact.abi, functionName: 'proofOf', args: [digest] });
  const receipt = { ...receiptDraft, chain: { chainId: 1404, registry: proxy.contractAddress, transactionHash: txHash, blockNumber: tx.blockNumber.toString(), blockHash: tx.blockHash, registrant: account, confirmations: 1 } };
  const check = verifyReceiptAgainstDigest(receipt, digest, bytes.byteLength);
  if (!check.ok || proof.registrant.toLowerCase() !== account.toLowerCase()) throw new Error('Local vertical proof verification failed.');
  process.stdout.write(`${JSON.stringify({ result: 'verified-local-proof', implementation: deployment.contractAddress, registry: proxy.contractAddress, transactionHash: txHash, receipt }, null, 2)}\n`);
} finally { await server.close(); }
