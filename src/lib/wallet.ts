import { createPublicClient, createWalletClient, custom, http, type Address, type Hex } from 'viem';
import { CHAIN_1404 } from './chain';
import { registryAbi } from './registry-abi';
import { proxyBytecode, proxyConstructorAbi, registryBytecode } from './deployment-artifacts';

type Eip1193Provider = { request: (request: { method: string; params?: unknown[] | object }) => Promise<unknown> };
declare global { interface Window { ethereum?: Eip1193Provider } }

const bdagChain = {
  id: 1404, name: CHAIN_1404.chainName, nativeCurrency: CHAIN_1404.nativeCurrency,
  rpcUrls: { default: { http: CHAIN_1404.rpcUrls } }, blockExplorers: { default: { name: 'BlockDAG Explorer', url: CHAIN_1404.blockExplorerUrls[0] } }
} as const;

export const DAGIT_UPGRADE_AUTHORITY = '0xEe104e82c5C999aD08ED657eB2dd1Bb2E94747e5' as const;

export function configuredRegistry(): Address | null {
  const value = import.meta.env.VITE_DAGIT_REGISTRY_ADDRESS?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value as Address : null;
}

export type ConnectedWallet = { account: Address };

export async function connectWallet(): Promise<ConnectedWallet> {
  if (!window.ethereum) throw new Error('No injected wallet was found. Install or unlock a compatible wallet.');
  const provider = window.ethereum;
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts[0]) throw new Error('Wallet returned no account.');
  const chainId = await provider.request({ method: 'eth_chainId' }) as string;
  if (chainId.toLowerCase() !== CHAIN_1404.chainId) {
    try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_1404.chainId }] }); }
    catch (error: unknown) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await provider.request({ method: 'wallet_addEthereumChain', params: [{ ...CHAIN_1404 }] });
    }
  }
  return { account: accounts[0] as Address };
}

export async function connectAndRegister(digest: Hex, manifestDigest: Hex) {
  const registry = configuredRegistry();
  if (!registry) throw new Error('Proof anchoring is not live yet. This demo will not send a transaction.');
  const { account } = await connectWallet();
  const provider = window.ethereum!;
  const wallet = createWalletClient({ chain: bdagChain, transport: custom(provider) });
  const transactionHash = await wallet.writeContract({ account, address: registry, abi: registryAbi, functionName: 'register', args: [digest, manifestDigest] });
  const publicClient = createPublicClient({ chain: bdagChain, transport: http(CHAIN_1404.rpcUrls[0]) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash, confirmations: 1 });
  if (receipt.status !== 'success') throw new Error('The wallet transaction was mined but reverted. No proof was recorded.');
  return { account, registry, transactionHash, receipt };
}

/** Deploys UUPS implementation and initialized ERC-1967 proxy from the approved owner wallet. */
export async function deployRegistry() {
  const { account } = await connectWallet();
  if (account.toLowerCase() !== DAGIT_UPGRADE_AUTHORITY.toLowerCase()) {
    throw new Error(`Connect the configured upgrade authority: ${DAGIT_UPGRADE_AUTHORITY}.`);
  }
  const provider = window.ethereum!;
  const wallet = createWalletClient({ chain: bdagChain, transport: custom(provider) });
  const publicClient = createPublicClient({ chain: bdagChain, transport: http(CHAIN_1404.rpcUrls[0]) });
  const implementationTransactionHash = await wallet.deployContract({ account, abi: registryAbi, bytecode: registryBytecode });
  const implementationReceipt = await publicClient.waitForTransactionReceipt({ hash: implementationTransactionHash, confirmations: 1 });
  if (implementationReceipt.status !== 'success' || !implementationReceipt.contractAddress) throw new Error('The implementation deployment did not complete.');
  const proxyTransactionHash = await wallet.deployContract({ account, abi: proxyConstructorAbi, bytecode: proxyBytecode, args: [implementationReceipt.contractAddress, DAGIT_UPGRADE_AUTHORITY] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: proxyTransactionHash, confirmations: 1 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('The proxy deployment did not complete.');
  return { account, implementation: implementationReceipt.contractAddress, implementationTransactionHash, transactionHash: proxyTransactionHash, registry: receipt.contractAddress, receipt };
}
