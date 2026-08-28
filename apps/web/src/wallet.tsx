import { CHAIN_IDS } from '@tutela/protocol';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
const CC3_CHAIN_ID = CHAIN_IDS.cc3Testnet;
const SEPOLIA_CHAIN_ID = CHAIN_IDS.sepolia;
export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isRabby?: boolean;
};
type Eip6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: EthereumProvider;
};
export type WalletOption = {
  id: string;
  name: string;
  icon: string | null;
  rdns: string | null;
  provider: EthereumProvider;
};
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  available: boolean;
  discoveryComplete: boolean;
  wallets: WalletOption[];
  selectedProvider: EthereumProvider | null;
  connect(walletId: string): Promise<boolean>;
  discoverWallets(): void;
  switchToCC3(): Promise<void>;
};
const WalletContext = createContext<WalletContextValue | null>(null);
function parseChainId(value: unknown) {
  return typeof value === 'string' ? Number.parseInt(value, 16) : null;
}
function legacyWalletName(provider: EthereumProvider, index: number, total: number) {
  if (provider.isRabby) return 'Rabby Wallet';
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider.isBraveWallet) return 'Brave Wallet';
  if (provider.isMetaMask) return 'MetaMask';
  return total > 1 ? `Browser wallet ${index + 1}` : 'Browser wallet';
}
function safeWalletIcon(value: string) {
  return /^data:image\/(?:gif|jpeg|png|svg\+xml|webp)(?:;[^,]*)?,/i.test(value) ? value : null;
}
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [discoveryComplete, setDiscoveryComplete] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<EthereumProvider | null>(null);
  const addWallet = useCallback((wallet: WalletOption) => {
    setWallets((current) => {
      const existingIndex = current.findIndex(
        (candidate) => candidate.id === wallet.id || candidate.provider === wallet.provider
      );
      if (existingIndex === -1) return [...current, wallet];
      const existing = current[existingIndex];
      if (!existing || existing.rdns || !wallet.rdns) return current;
      const updated = [...current];
      updated[existingIndex] = wallet;
      return updated;
    });
  }, []);
  const addLegacyWallets = useCallback(() => {
    const injected = window.ethereum;
    const legacyProviders = injected?.providers?.length
      ? injected.providers
      : injected
        ? [injected]
        : [];
    legacyProviders.forEach((provider, index) => {
      const name = legacyWalletName(provider, index, legacyProviders.length);
      addWallet({
        id: `legacy-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${index}`,
        name,
        icon: null,
        rdns: null,
        provider,
      });
    });
    setDiscoveryComplete(true);
  }, [addWallet]);
  const discoverWallets = useCallback(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    addLegacyWallets();
  }, [addLegacyWallets]);
  useEffect(() => {
    const handleAnnouncement = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (!detail?.provider || !detail.info?.uuid || !detail.info.name) return;
      addWallet({
        id: detail.info.uuid,
        name: detail.info.name,
        icon: safeWalletIcon(detail.info.icon),
        rdns: detail.info.rdns || null,
        provider: detail.provider,
      });
    };
    window.addEventListener('eip6963:announceProvider', handleAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const legacyTimer = window.setTimeout(addLegacyWallets, 250);
    return () => {
      window.clearTimeout(legacyTimer);
      window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
    };
  }, [addLegacyWallets, addWallet]);
  useEffect(() => {
    if (!selectedProvider) return;
    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts[0] ?? null);
    };
    const handleChain = (...args: unknown[]) => setChainId(parseChainId(args[0]));
    selectedProvider.on?.('accountsChanged', handleAccounts);
    selectedProvider.on?.('chainChanged', handleChain);
    return () => {
      selectedProvider.removeListener?.('accountsChanged', handleAccounts);
      selectedProvider.removeListener?.('chainChanged', handleChain);
    };
  }, [selectedProvider]);
  const connect = useCallback(
    async (walletId: string) => {
      const wallet = wallets.find((candidate) => candidate.id === walletId);
      setError(null);
      if (!wallet) {
        setError('That wallet is no longer available. Reopen the selector and try again.');
        return false;
      }
      setConnecting(true);
      try {
        const accounts = (await wallet.provider.request({
          method: 'eth_requestAccounts',
        })) as string[];
        const chain = await wallet.provider.request({ method: 'eth_chainId' });
        setSelectedProvider(wallet.provider);
        setAddress(accounts[0] ?? null);
        setChainId(parseChainId(chain));
        return Boolean(accounts[0]);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Wallet connection was cancelled.');
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [wallets]
  );
  const switchToCC3 = useCallback(async () => {
    if (!selectedProvider) return;
    setError(null);
    try {
      await selectedProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CC3_CHAIN_ID.toString(16)}` }],
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to switch to Creditcoin CC3.');
    }
  }, [selectedProvider]);
  const value = useMemo(
    () => ({
      address,
      chainId,
      connecting,
      error,
      available: wallets.length > 0,
      discoveryComplete,
      wallets,
      selectedProvider,
      connect,
      discoverWallets,
      switchToCC3,
    }),
    [
      address,
      chainId,
      connecting,
      error,
      wallets,
      discoveryComplete,
      selectedProvider,
      connect,
      discoverWallets,
      switchToCC3,
    ]
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export function useWallet() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error('useWallet must be used inside WalletProvider');
  return wallet;
}
export function chainLabel(chainId: number | null) {
  if (chainId === CC3_CHAIN_ID) return 'Creditcoin CC3';
  if (chainId === SEPOLIA_CHAIN_ID) return 'Sepolia';
  if (chainId === null) return 'Not connected';
  return `Chain ${chainId}`;
}
export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
