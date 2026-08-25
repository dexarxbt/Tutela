import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProofAction } from '@tutela/protocol';
import { PersistentQueue } from '../src/queue';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('PersistentQueue', () => {
  it('deduplicates source transactions and survives restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tutela-queue-'));
    directories.push(directory);
    const file = join(directory, 'queue.json');
    const queue = await PersistentQueue.open(file, 100);
    const job = {
      transactionHash: `0x${'ab'.repeat(32)}`,
      action: ProofAction.Activate,
      blockNumber: 101,
    };
    await queue.discover(job);
    await queue.discover(job);
    await queue.setCursor(102);

    const reopened = await PersistentQueue.open(file, 0);
    expect(reopened.cursor).toBe(102);
    expect(reopened.pending()).toHaveLength(1);
    expect(JSON.parse(await readFile(file, 'utf8')).version).toBe(1);
  });
});
