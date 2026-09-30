import { decodeFunctionResult, encodeFunctionData, type Address, type Hex } from 'viem';
import { registryAbi } from './registry-abi';

export const CHAIN_1404 = {
  chainId: '0x57c',
  chainName: 'BlockDAG Mainnet',
  nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 },
  rpcUrls: ['https://rpc.blockdag.engineering/'],
  blockExplorerUrls: ['https://explorer.blockdag.engineering/']
} as const;

export const verificationRpcQuorum = [
  'https://rpc.blockdag.engineering/',
  'https://rpc.capedag.com/',
  'https://rpc.east.bdag-us.org/'
] as const;

export type RegisteredProof = { registrant: Address; registeredAt: bigint; manifestDigest: Hex };
export type QuorumResult<T> = { ok: true; value: T; agreeingEndpoints: string[] } | { ok: false; reason: string };

async function rpc(url: string, method: string, params: unknown[], timeoutMs = 8_000): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
  const body = await response.json() as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || 'JSON-RPC error');
  return body.result;
}

export async function requireCanonicalQuorum(): Promise<QuorumResult<{ blockNumber: Hex; blockHash: Hex }>> {
  const heads = await Promise.allSettled(verificationRpcQuorum.map(async (url) => {
    const [chainId, block] = await Promise.all([rpc(url, 'eth_chainId', []), rpc(url, 'eth_getBlockByNumber', ['latest', false])]) as [string, { number: Hex; hash: Hex }];
    if (chainId !== CHAIN_1404.chainId || !block?.hash || !block?.number) throw new Error('Unexpected network response');
    return { url, blockNumber: block.number };
  }));
  const valid = heads.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (valid.length < 2) return { ok: false, reason: 'Fewer than two canonical RPC nodes responded.' };
  const checkpoint = valid.reduce((lowest, entry) => BigInt(entry.blockNumber) < BigInt(lowest) ? entry.blockNumber : lowest, valid[0].blockNumber);
  const candidates = await Promise.allSettled(valid.map(async ({ url }) => {
    const block = await rpc(url, 'eth_getBlockByNumber', [checkpoint, false]) as { hash: Hex };
    if (!block?.hash) throw new Error('Checkpoint block unavailable');
    return { url, blockNumber: checkpoint, blockHash: block.hash };
  }));
  const checked = candidates.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const groups = new Map<string, typeof checked>();
  for (const value of checked) {
    const key = `${value.blockNumber}:${value.blockHash}`;
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  const winner = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!winner || winner.length < 2) return { ok: false, reason: 'Two canonical RPC nodes did not agree on the current head.' };
  return { ok: true, value: { blockNumber: winner[0].blockNumber, blockHash: winner[0].blockHash }, agreeingEndpoints: winner.map((entry) => entry.url) };
}

export async function readProofByQuorum(registry: Address, digest: Hex): Promise<QuorumResult<RegisteredProof | null>> {
  const checkpoint = await requireCanonicalQuorum();
  if (!checkpoint.ok) return checkpoint;
  const data = encodeFunctionData({ abi: registryAbi, functionName: 'proofOf', args: [digest] });
  const responses = await Promise.allSettled(checkpoint.agreeingEndpoints.map(async (url) => ({ url, value: await rpc(url, 'eth_call', [{ to: registry, data }, 'latest']) as Hex })));
  const matched = responses.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const groups = new Map<string, typeof matched>();
  for (const response of matched) groups.set(response.value, [...(groups.get(response.value) ?? []), response]);
  const winner = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!winner || winner.length < 2) return { ok: false, reason: 'Two canonical RPC nodes did not agree on the proof record.' };
  const proof = decodeFunctionResult({ abi: registryAbi, functionName: 'proofOf', data: winner[0].value }) as RegisteredProof;
  if (proof.registrant === '0x0000000000000000000000000000000000000000') return { ok: true, value: null, agreeingEndpoints: winner.map((entry) => entry.url) };
  return { ok: true, value: proof, agreeingEndpoints: winner.map((entry) => entry.url) };
}
