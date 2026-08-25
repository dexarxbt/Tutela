import { blockProver, chainInfo, proofProvider } from '@gluwa/usc-sdk';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { CHAIN_IDS, ProofAction, tutelaVaultAbi } from '@tutela/protocol';
import type { ProverConfig } from './config';
import { logger } from './logger';
import type { PersistentQueue, ProofJob } from './queue';
import { validateSourceReceipt } from './semantics';

export interface ProverRuntime {
  sourceProvider: JsonRpcProvider;
  destinationProvider: JsonRpcProvider;
  chainKey: number;
  proofBuilder: proofProvider.service.ProofBuilder;
  precompile: blockProver.PrecompileBlockProver;
  vault: Contract;
}

export async function createRuntime(config: ProverConfig): Promise<ProverRuntime> {
  const sourceProvider = new JsonRpcProvider(config.SEPOLIA_RPC_URL);
  const destinationProvider = new JsonRpcProvider(config.CC3_RPC_URL);
  const [sourceNetwork, destinationNetwork] = await Promise.all([
    sourceProvider.getNetwork(),
    destinationProvider.getNetwork(),
  ]);
  if (Number(sourceNetwork.chainId) !== config.expectedSourceChainId) {
    throw new Error(`Expected Sepolia ${CHAIN_IDS.sepolia}, received ${sourceNetwork.chainId}`);
  }
  if (Number(destinationNetwork.chainId) !== config.expectedDestinationChainId) {
    throw new Error(
      `Expected CC3 testnet ${CHAIN_IDS.cc3Testnet}, received ${destinationNetwork.chainId}`
    );
  }

  const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(destinationProvider);
  const supportedChains = await chainInfoProvider.getSupportedChains();
  const sourceChain = supportedChains.find(
    (chain) => chain.chainId === config.expectedSourceChainId
  );
  if (!sourceChain) throw new Error('Sepolia is not currently supported by CC3 ChainInfo');

  const wallet = new Wallet(config.CC3_PRIVATE_KEY, destinationProvider);
  return {
    sourceProvider,
    destinationProvider,
    chainKey: sourceChain.chainKey,
    proofBuilder: new proofProvider.service.ProofBuilder(
      sourceChain.chainKey,
      config.PROOF_BUILDER_URL
    ),
    precompile: new blockProver.PrecompileBlockProver(destinationProvider),
    vault: new Contract(config.TUTELA_VAULT_ADDRESS, tutelaVaultAbi, wallet),
  };
}

export async function processJob(
  config: ProverConfig,
  runtime: ProverRuntime,
  queue: PersistentQueue,
  job: ProofJob
) {
  const receipt = await runtime.sourceProvider.getTransactionReceipt(job.transactionHash);
  if (!receipt) throw new Error('Source receipt is not available');
  if (receipt.blockNumber !== job.blockNumber)
    throw new Error('Source transaction was reorganized');
  await queue.update(job.transactionHash, { status: 'source-confirmed', error: undefined });

  const semantics = validateSourceReceipt(job.action, receipt, config.SOURCE_REGISTRY_ADDRESS);
  await queue.update(job.transactionHash, { status: 'awaiting-attestation' });
  await runtime.proofBuilder.waitUntilHeightAttested(
    runtime.chainKey,
    receipt.blockNumber,
    config.POLL_INTERVAL_MS,
    config.ATTESTATION_TIMEOUT_MS
  );

  const result = await runtime.proofBuilder.getProof(job.transactionHash);
  if (!result.success || !result.data) {
    throw new Error(result.error ?? 'Proof builder returned no proof');
  }
  const proof = result.data;
  if (proof.chainKey !== runtime.chainKey || proof.headerNumber !== receipt.blockNumber) {
    throw new Error('Proof metadata does not match the source receipt');
  }
  await queue.update(job.transactionHash, { status: 'proof-ready' });

  const verified = await runtime.precompile.verifySingle(
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof
  );
  if (!verified) throw new Error('CC3 preflight rejected the Attestcoin proof');
  await queue.update(job.transactionHash, { status: 'simulated' });

  const submitProof = runtime.vault.getFunction('submitProof');
  const transaction = await submitProof(
    job.action,
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof.root,
    proof.merkleProof.siblings,
    proof.continuityProof.lowerEndpointDigest,
    proof.continuityProof.roots
  );
  await queue.update(job.transactionHash, {
    status: 'submitted',
    destinationTransactionHash: transaction.hash,
  });

  const destinationReceipt = await transaction.wait(config.CONFIRMATIONS);
  if (!destinationReceipt || destinationReceipt.status !== 1) {
    throw new Error('Destination proof transaction failed');
  }
  await queue.update(job.transactionHash, {
    status: 'confirmed',
    attempts: job.attempts,
    nextAttemptAt: 0,
    error: undefined,
  });
  logger.info('proof-confirmed', {
    action: ProofAction[job.action],
    coverageId: semantics.coverageId,
    sessionId: semantics.sessionId,
    sourceTransactionHash: job.transactionHash,
    destinationTransactionHash: destinationReceipt.hash,
  });
}
