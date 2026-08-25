import { Interface, TransactionReceipt } from 'ethers';
import { describe, expect, it } from 'vitest';
import { ProofAction, serviceSessionRegistryAbi } from '@tutela/protocol';
import { validateSourceReceipt } from '../src/semantics';

const registry = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const sessionId = `0x${'11'.repeat(32)}`;
const coverageId = `0x${'22'.repeat(32)}`;
const programId = `0x${'33'.repeat(32)}`;
const termsHash = `0x${'44'.repeat(32)}`;
const iface = new Interface(serviceSessionRegistryAbi);

function receipt(address: string, event = 'SessionOpened', status = 1) {
  const encoded = iface.encodeEventLog(iface.getEvent(event)!, [
    sessionId,
    coverageId,
    ...(event === 'SessionOpened'
      ? [
          programId,
          '0x3333333333333333333333333333333333333333',
          '0x4444444444444444444444444444444444444444',
          '0x5555555555555555555555555555555555555555',
          1_800_003_600,
          25_000,
          termsHash,
        ]
      : event === 'SessionSettled'
        ? [32_500, 1_800_000_100, termsHash]
        : [1_800_003_600]),
  ]);
  return {
    status,
    logs: [{ address, topics: encoded.topics, data: encoded.data }],
  } as unknown as TransactionReceipt;
}

describe('validateSourceReceipt', () => {
  it('accepts one expected event from the configured registry', () => {
    expect(validateSourceReceipt(ProofAction.Activate, receipt(registry), registry)).toEqual({
      eventName: 'SessionOpened',
      sessionId,
      coverageId,
    });
  });

  it('rejects a lookalike event from another contract', () => {
    expect(() => validateSourceReceipt(ProofAction.Activate, receipt(other), registry)).toThrow(
      'exactly one SessionOpened'
    );
  });

  it('rejects reverted source transactions', () => {
    expect(() =>
      validateSourceReceipt(ProofAction.Activate, receipt(registry, 'SessionOpened', 0), registry)
    ).toThrow('reverted');
  });
});
