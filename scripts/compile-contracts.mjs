import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const root = path.resolve(import.meta.dirname, '..');
const contractsDir = path.join(root, 'contracts');
const sources = Object.fromEntries(['DAGITRegistry.sol', 'DAGITRegistryProxy.sol'].map((name) => [name, { content: fs.readFileSync(path.join(contractsDir, name), 'utf8') }]));
const findImports = (importPath) => {
  const candidates = [path.join(contractsDir, importPath), path.join(root, 'node_modules', importPath)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ? { contents: fs.readFileSync(found, 'utf8') } : { error: `Import not found: ${importPath}` };
};
const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } }
  }
};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = output.errors ?? [];
for (const item of errors) process.stderr.write(`${item.formattedMessage}\n`);
if (errors.some((item) => item.severity === 'error')) process.exit(1);
const artifact = output.contracts['DAGITRegistry.sol'].DAGITRegistry;
const proxyArtifact = output.contracts['DAGITRegistryProxy.sol'].DAGITRegistryProxy;
const deployedBytes = artifact.evm.deployedBytecode.object.length / 2;
if (deployedBytes > 24_576) throw new Error(`Implementation runtime bytecode ${deployedBytes} exceeds EIP-170 limit`);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'DAGITRegistry.json'), `${JSON.stringify({ ...artifact, compiler: solc.version(), evmVersion: 'paris' }, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'artifacts', 'DAGITRegistryProxy.json'), `${JSON.stringify({ ...proxyArtifact, compiler: solc.version(), evmVersion: 'paris' }, null, 2)}\n`);
process.stdout.write(`Compiled DAGITRegistry UUPS implementation and ERC-1967 proxy with solc ${solc.version()} (Paris; implementation runtime ${deployedBytes} bytes).\n`);
