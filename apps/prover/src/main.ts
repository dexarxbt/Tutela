import 'dotenv/config';
import { loadConfig } from './config';
import { indexSourceEvents } from './indexer';
import { logger } from './logger';
import { createRuntime, processJob } from './processor';
import { PersistentQueue } from './queue';

const once = process.argv.includes('--once');
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

async function runCycle(
  config: ReturnType<typeof loadConfig>,
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  queue: PersistentQueue
) {
  await indexSourceEvents(runtime.sourceProvider, config.SOURCE_REGISTRY_ADDRESS, queue);
  for (const job of queue.pending()) {
    if (stopping) return;
    try {
      await processJob(config, runtime, queue, job);
    } catch (error) {
      await queue.retry(job.transactionHash, error);
      logger.warn('proof-job-retry', {
        sourceTransactionHash: job.transactionHash,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function main() {
  const config = loadConfig();
  const queue = await PersistentQueue.open(config.queueFile, config.SOURCE_START_BLOCK);
  const runtime = await createRuntime(config);
  logger.info('prover-started', {
    sourceRegistry: config.SOURCE_REGISTRY_ADDRESS,
    tutelaVault: config.TUTELA_VAULT_ADDRESS,
    signerAddress: runtime.signerAddress,
    sourceChainKey: runtime.chainKey,
    mode: once ? 'once' : 'continuous',
  });

  do {
    await runCycle(config, runtime, queue);
    if (!once && !stopping) {
      await new Promise((resolve) => setTimeout(resolve, config.POLL_INTERVAL_MS));
    }
  } while (!once && !stopping);

  logger.info('prover-stopped');
}

main().catch((error: unknown) => {
  logger.error('prover-fatal', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
