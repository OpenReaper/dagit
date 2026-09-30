import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const artifactPath = path.join(root, 'artifacts', 'DAGITRegistry.json');
if (!fs.existsSync(artifactPath)) throw new Error('Missing compiled registry artifact. Run contracts:compile.');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const runtimeBytes = artifact.evm.deployedBytecode.object.length / 2;
if (runtimeBytes > 24_576) throw new Error(`Runtime bytecode ${runtimeBytes} exceeds the EIP-170 limit.`);
const gates = [
  'No production deployment or mainnet transaction was performed by this preflight.',
  'Before deployment: independent Solidity audit and bytecode/source review.',
  'Before deployment: approved legal copy, privacy notice, and proof-limitation wording.',
  'Before deployment: approved multisig/signer and controlled non-production rehearsal.',
  'Before deployment: re-run canonical fixed-checkpoint and finality policy checks.',
  'Before release: verify deployed origin CSP and browser network trace contains no file upload.'
];
process.stdout.write(`${JSON.stringify({ result: 'preflight-passed', compiler: artifact.compiler, evmVersion: artifact.evmVersion, runtimeBytes, gates }, null, 2)}\n`);
