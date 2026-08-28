import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ProofAction } from '@tutela/protocol';
export type JobStatus =
  | 'discovered'
  | 'source-confirmed'
  | 'awaiting-attestation'
  | 'proof-ready'
  | 'simulated'
  | 'submitted'
  | 'confirmed'
  | 'rejected';
export interface ProofJob {
  transactionHash: string;
  action: ProofAction;
  blockNumber: number;
  status: JobStatus;
  attempts: number;
  nextAttemptAt: number;
  destinationTransactionHash?: string;
  error?: string;
  updatedAt: string;
}
interface QueueState {
  version: 1;
  sourceCursor: number;
  jobs: Record<string, ProofJob>;
}
const emptyState = (sourceCursor: number): QueueState => ({
  version: 1,
  sourceCursor,
  jobs: {},
});
export class PersistentQueue {
  private state: QueueState;
  private constructor(
    private readonly file: string,
    state: QueueState
  ) {
    this.state = state;
  }
  static async open(file: string, initialCursor: number) {
    try {
      const state = JSON.parse(await readFile(file, 'utf8')) as QueueState;
      if (state.version !== 1) throw new Error(`Unsupported queue version: ${state.version}`);
      return new PersistentQueue(file, state);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const queue = new PersistentQueue(file, emptyState(initialCursor));
      await queue.persist();
      return queue;
    }
  }
  get cursor() {
    return this.state.sourceCursor;
  }
  async setCursor(cursor: number) {
    if (cursor <= this.state.sourceCursor) return;
    this.state.sourceCursor = cursor;
    await this.persist();
  }
  async discover(job: Pick<ProofJob, 'transactionHash' | 'action' | 'blockNumber'>) {
    const key = job.transactionHash.toLowerCase();
    if (this.state.jobs[key]) return;
    this.state.jobs[key] = {
      ...job,
      status: 'discovered',
      attempts: 0,
      nextAttemptAt: 0,
      updatedAt: new Date().toISOString(),
    };
    await this.persist();
  }
  pending(now = Date.now()) {
    return Object.values(this.state.jobs)
      .filter(
        (job) => job.status !== 'confirmed' && job.status !== 'rejected' && job.nextAttemptAt <= now
      )
      .sort((left, right) => left.blockNumber - right.blockNumber);
  }
  async update(transactionHash: string, patch: Partial<ProofJob>) {
    const key = transactionHash.toLowerCase();
    const current = this.state.jobs[key];
    if (!current) throw new Error(`Unknown proof job ${transactionHash}`);
    this.state.jobs[key] = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.persist();
  }
  async retry(transactionHash: string, error: unknown) {
    const key = transactionHash.toLowerCase();
    const current = this.state.jobs[key];
    if (!current) throw new Error(`Unknown proof job ${transactionHash}`);
    const attempts = current.attempts + 1;
    const terminal = attempts >= 8;
    const delay = Math.min(15_000 * 2 ** Math.min(attempts, 6), 15 * 60_000);
    await this.update(transactionHash, {
      attempts,
      status: terminal ? 'rejected' : current.status,
      nextAttemptAt: terminal ? 0 : Date.now() + delay,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  private async persist() {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    await rename(temporary, this.file);
  }
}
