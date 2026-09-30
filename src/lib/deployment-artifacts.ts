import registryArtifact from '../../artifacts/DAGITRegistry.json';
import proxyArtifact from '../../artifacts/DAGITRegistryProxy.json';
import type { Hex } from 'viem';

// Compiled during every production build from the reviewed Solidity sources.
export const registryBytecode = `0x${registryArtifact.evm.bytecode.object}` as Hex;
export const proxyBytecode = `0x${proxyArtifact.evm.bytecode.object}` as Hex;

export const proxyConstructorAbi = [{
  type: 'constructor',
  inputs: [
    { name: 'implementation', type: 'address' },
    { name: 'initialOwner', type: 'address' }
  ],
  stateMutability: 'nonpayable'
}] as const;
