import { Interface, JsonRpcProvider } from 'ethers';
import { ProofAction, serviceSessionRegistryAbi } from '@tutela/protocol';
import type { PersistentQueue } from './queue';

const registryInterface = new Interface(serviceSessionRegistryAbi);
const topics = {
  [registryInterface.getEvent('SessionOpened')!.topicHash]: ProofAction.Activate,
  [registryInterface.getEvent('SessionSettled')!.topicHash]: ProofAction.SettleSuccess,
  [registryInterface.getEvent('SessionFailed')!.topicHash]: ProofAction.SettleFailure,
} as const;

export async function indexSourceEvents(
  provider: JsonRpcProvider,
  registry: string,
  queue: PersistentQueue
) {
  const latest = await provider.getBlockNumber();
  let fromBlock = queue.cursor;
  if (fromBlock > latest) return;

  while (fromBlock <= latest) {
    const toBlock = Math.min(fromBlock + 1_999, latest);
    const logs = await provider.getLogs({
      address: registry,
      fromBlock,
      toBlock,
      topics: [Object.keys(topics)],
    });

    for (const log of logs) {
      const action = topics[log.topics[0] as keyof typeof topics];
      if (action === undefined) continue;
      await queue.discover({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        action,
      });
    }

    await queue.setCursor(toBlock + 1);
    fromBlock = toBlock + 1;
  }
}
