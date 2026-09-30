const endpoints = ['https://rpc.blockdag.engineering/', 'https://rpc.capedag.com/', 'https://rpc.east.bdag-us.org/'];
async function rpc(url, method, params = []) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }), signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || `HTTP ${response.status}`);
  return body.result;
}
const heads = await Promise.all(endpoints.map(async (url) => {
  const [chainId, block] = await Promise.all([rpc(url, 'eth_chainId'), rpc(url, 'eth_getBlockByNumber', ['latest', false])]);
  return { url, chainId, number: block.number, hash: block.hash };
}));
const canonicalHeads = heads.filter((entry) => entry.chainId === '0x57c');
if (canonicalHeads.length < 2) throw new Error(`Fewer than two Chain 1404 endpoints responded: ${JSON.stringify(heads)}`);
const checkpoint = canonicalHeads.reduce((lowest, entry) => BigInt(entry.number) < BigInt(lowest) ? entry.number : lowest, canonicalHeads[0].number);
const checks = await Promise.all(canonicalHeads.map(async ({ url }) => {
  const block = await rpc(url, 'eth_getBlockByNumber', [checkpoint, false]);
  return { url, number: block.number, hash: block.hash, stateRoot: block.stateRoot };
}));
const groups = new Map();
for (const check of checks) {
  const key = `${check.hash}:${check.stateRoot}`;
  groups.set(key, [...(groups.get(key) ?? []), check]);
}
const matching = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
if (matching.length < 2) throw new Error(`No Chain 1404 checkpoint quorum at ${checkpoint}: ${JSON.stringify({ heads, checks })}`);
process.stdout.write(`${JSON.stringify({ result: 'quorum', checkpoint, agreeing: matching.length, heads, checks: matching }, null, 2)}\n`);
