import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, keccak256, stringToHex } from 'viem';

const root = path.resolve(import.meta.dirname, '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'DAGITRegistry.json'), 'utf8'));
const localChain = { id: 1404, name: 'BlockDAG Local Test', nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1'] } } };

async function withChain(run) {
  // Ganache's current Node build accepts Paris-targeted bytecode but does not expose a `paris` hardfork label.
  const server = ganache.server({ chain: { chainId: 1404 }, logging: { quiet: true } });
  await server.listen(0, '127.0.0.1');
  const provider = server.provider;
  const [account] = await provider.request({ method: 'eth_accounts' });
  const wallet = createWalletClient({ chain: localChain, transport: custom(provider) });
  const publicClient = createPublicClient({ chain: localChain, transport: custom(provider) });
  try { await run({ account, wallet, publicClient }); } finally { await server.close(); }
}

test('registers one digest, exposes its proof, and rejects duplicate registration', async () => withChain(async ({ account, wallet, publicClient }) => {
  const deploymentHash = await wallet.deployContract({ account, abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, gas: 1_000_000n });
  const deployment = await publicClient.getTransactionReceipt({ hash: deploymentHash });
  const address = deployment.contractAddress;
  assert.ok(address);
  const registry = await publicClient.getCode({ address: address });
  assert.ok(registry && registry !== '0x');
  const digest = keccak256(stringToHex('sha256 digest test fixture'));
  const manifestDigest = keccak256(stringToHex('dagit-proof/v1\nsha-256\nfixture'));
  const hash = await wallet.writeContract({ account, address, abi: artifact.abi, functionName: 'register', args: [digest, manifestDigest], gas: 300_000n });
  const receipt = await publicClient.getTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success');
  const proof = await publicClient.readContract({ address, abi: artifact.abi, functionName: 'proofOf', args: [digest] });
  assert.equal(proof.registrant.toLowerCase(), account.toLowerCase());
  assert.equal(proof.manifestDigest, manifestDigest);
  await assert.rejects(() => publicClient.simulateContract({ account, address, abi: artifact.abi, functionName: 'register', args: [digest, manifestDigest] }));
}));

test('rejects an all-zero digest', async () => withChain(async ({ account, wallet, publicClient }) => {
  const deployment = await wallet.deployContract({ account, abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, gas: 1_000_000n });
  const deployed = await publicClient.getTransactionReceipt({ hash: deployment });
  await assert.rejects(() => publicClient.simulateContract({ account, address: deployed.contractAddress, abi: artifact.abi, functionName: 'register', args: [`0x${'00'.repeat(32)}`, `0x${'11'.repeat(32)}`] }));
}));
