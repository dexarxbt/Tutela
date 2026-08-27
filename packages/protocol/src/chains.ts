export const CHAIN_IDS = {
  sepolia: 11155111,
  cc3Testnet: 102031,
} as const;

export const ATTESTCOIN = {
  expectedSepoliaChainKey: 1,
  chainInfoPrecompile: '0x0000000000000000000000000000000000000fd3',
  blockProverPrecompile: '0x0000000000000000000000000000000000000FD2',
  evmDecoder: '0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f',
  proofBuilderUrl: 'https://prover.cc3-testnet.creditcoin.network',
  maxBatchSize: 10,
  maxBatchRange: 1_000,
} as const;

export const PUBLIC_RPCS = {
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  cc3Testnet: 'https://rpc.cc3-testnet.creditcoin.network',
} as const;

export const EXPLORERS = {
  sepolia: 'https://sepolia.etherscan.io',
  cc3Testnet: 'https://creditcoin-testnet.blockscout.com',
} as const;
