import { describe, expect, it } from 'vitest';
import {
  coverages,
  failedLifecycle,
  findCoverage,
  formatCtcWei,
  successfulLifecycle,
  verifiedProgram,
} from './data';

describe('verified evidence adapter', () => {
  it('adapts the exact published success snapshot', () => {
    expect(successfulLifecycle).toMatchObject({
      id: '0x60cf6800840d779b92454f6358445bfe66825cc0af748e562accf5276c30444c',
      sessionId: '0xb9bc568c6e5785465870e377be300d1dd41632d420b75615b1740eaeefc07b47',
      programId: '0x88c009c1caeaa9b2889593791115138e662f8d6e3e6dea58ff03491037187f07',
      outcome: 'success',
      statusLabel: 'Verified success',
      premium: '0.001 CTC',
      customerCredit: '0.001 CTC',
      deliveredUnits: '1 raw unit',
    });
    expect(successfulLifecycle.source.explorerUrl).toBe(
      `https://sepolia.etherscan.io/tx/${successfulLifecycle.source.transactionHash}`
    );
    expect(successfulLifecycle.destination.explorerUrl).toBe(
      `https://creditcoin-testnet.blockscout.com/tx/${successfulLifecycle.destination.transactionHash}`
    );
  });

  it('adapts the exact published failure and balance deltas', () => {
    expect(failedLifecycle).toMatchObject({
      id: '0xd1c9c247c2aab9ef519b2cceec8ac36121bee6e66e1f8a0d73542b34b18a59ef',
      outcome: 'failure',
      statusLabel: 'Verified failure',
      premium: '0.001 CTC',
      payout: '0.01 CTC',
      customerCredit: '0.011 CTC',
      deliveredUnits: null,
      operatorBondBefore: '0.1 CTC',
      operatorBondAfter: '0.09 CTC',
    });
  });

  it('publishes only the two settled snapshots in destination block order', () => {
    expect(coverages.map((coverage) => coverage.id)).toEqual([
      failedLifecycle.id,
      successfulLifecycle.id,
    ]);
    expect(findCoverage(successfulLifecycle.id.toUpperCase())).toBe(successfulLifecycle);
    expect(findCoverage('0xdead')).toBeUndefined();
    expect(verifiedProgram).toMatchObject({
      lifecycleCount: 2,
      initialBond: '0.1 CTC',
      recordedBond: '0.09 CTC',
      payout: '0.01 CTC',
      premium: '0.001 CTC',
    });
  });

  it('formats CTC wei without inventing precision', () => {
    expect(formatCtcWei(0n)).toBe('0 CTC');
    expect(formatCtcWei('1000000000000000000')).toBe('1 CTC');
    expect(formatCtcWei('12000000000000000')).toBe('0.012 CTC');
  });
});
