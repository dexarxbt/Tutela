import { resolve } from 'node:path';
import { z } from 'zod';
import { ATTESTCOIN, CHAIN_IDS, PUBLIC_RPCS } from '@tutela/protocol';

const envSchema = z.object({
  SEPOLIA_RPC_URL: z.url().default(PUBLIC_RPCS.sepolia),
  CC3_RPC_URL: z.url().default(PUBLIC_RPCS.cc3Testnet),
  PROOF_BUILDER_URL: z.url().default(ATTESTCOIN.proofBuilderUrl),
  SOURCE_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  TUTELA_VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  CC3_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  SOURCE_START_BLOCK: z.coerce.number().int().nonnegative().default(0),
  POLL_INTERVAL_MS: z.coerce.number().int().min(2_000).default(15_000),
  ATTESTATION_TIMEOUT_MS: z.coerce.number().int().min(60_000).default(900_000),
  CONFIRMATIONS: z.coerce.number().int().min(1).max(12).default(1),
  QUEUE_FILE: z.string().default('.data/prover-queue.json'),
});

export type ProverConfig = ReturnType<typeof loadConfig>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const value = envSchema.parse(environment);
  return {
    ...value,
    queueFile: resolve(process.cwd(), value.QUEUE_FILE),
    expectedSourceChainId: CHAIN_IDS.sepolia,
    expectedDestinationChainId: CHAIN_IDS.cc3Testnet,
  } as const;
}
