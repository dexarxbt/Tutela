import { CHAIN_IDS } from '@tutela/protocol';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CC3_CHAIN_ID = CHAIN_IDS.cc3Testnet;
const SEPOLIA_CHAIN_ID = CHAIN_IDS.sepolia;

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
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
  connect(): Promise<void>;
  switchToCC3(): Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function parseChainId(value: unknown) {
  return typeof value === 'string' ? Number.parseInt(value, 16) : null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;

    void Promise.all([
      provider.request({ method: 'eth_accounts' }),
      provider.request({ method: 'eth_chainId' }),
    ]).then(([accounts, chain]) => {
      const accountList = accounts as string[];
      setAddress(accountList[0] ?? null);
      setChainId(parseChainId(chain));
    });

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts[0] ?? null);
    };
    const handleChain = (...args: unknown[]) => setChainId(parseChainId(args[0]));
    provider.on?.('accountsChanged', handleAccounts);
    provider.on?.('chainChanged', handleChain);
    return () => {
      provider.removeListener?.('accountsChanged', handleAccounts);
      provider.removeListener?.('chainChanged', handleChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    setError(null);
    if (!provider) {
      setError('No browser wallet detected. Install an EIP-1193 wallet to connect.');
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const chain = await provider.request({ method: 'eth_chainId' });
      setAddress(accounts[0] ?? null);
      setChainId(parseChainId(chain));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Wallet connection was cancelled.');
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchToCC3 = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    setError(null);
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CC3_CHAIN_ID.toString(16)}` }],
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to switch to Creditcoin CC3.');
    }
  }, []);

  const value = useMemo(
    () => ({
      address,
      chainId,
      connecting,
      error,
      available: typeof window !== 'undefined' && Boolean(window.ethereum),
      connect,
      switchToCC3,
    }),
    [address, chainId, connecting, error, connect, switchToCC3]
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
