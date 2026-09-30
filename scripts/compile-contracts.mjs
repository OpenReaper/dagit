import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'contracts', 'DAGITRegistry.sol');
const input = {
  language: 'Solidity',
  sources: { 'DAGITRegistry.sol': { content: fs.readFileSync(sourcePath, 'utf8') } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } }
  }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors ?? [];
for (const item of errors) process.stderr.write(`${item.formattedMessage}\n`);
if (errors.some((item) => item.severity === 'error')) process.exit(1);
const artifact = output.contracts['DAGITRegistry.sol'].DAGITRegistry;
const deployedBytes = artifact.evm.deployedBytecode.object.length / 2;
if (deployedBytes > 24_576) throw new Error(`Runtime bytecode ${deployedBytes} exceeds EIP-170 limit`);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'DAGITRegistry.json'), `${JSON.stringify({ ...artifact, compiler: solc.version(), evmVersion: 'paris' }, null, 2)}\n`);
process.stdout.write(`Compiled DAGITRegistry with solc ${solc.version()} (Paris; runtime ${deployedBytes} bytes).\n`);
