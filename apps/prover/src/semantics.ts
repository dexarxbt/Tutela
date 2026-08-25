import { Interface, type TransactionReceipt, getAddress } from 'ethers';
import { ProofAction, serviceSessionRegistryAbi } from '@tutela/protocol';

const registryInterface = new Interface(serviceSessionRegistryAbi);
const eventByAction = {
  [ProofAction.Activate]: 'SessionOpened',
  [ProofAction.SettleSuccess]: 'SessionSettled',
  [ProofAction.SettleFailure]: 'SessionFailed',
} as const;

export interface SourceSemantics {
  eventName: string;
  sessionId: string;
  coverageId: string;
}

export function validateSourceReceipt(
  action: ProofAction,
  receipt: TransactionReceipt,
  sourceRegistry: string
): SourceSemantics {
  if (receipt.status !== 1) throw new Error('Source transaction reverted');
  const registry = getAddress(sourceRegistry);
  const expectedEvent = eventByAction[action];
  const matches = receipt.logs.flatMap((log) => {
    if (getAddress(log.address) !== registry) return [];
    try {
      const parsed = registryInterface.parseLog(log);
      return parsed?.name === expectedEvent ? [parsed] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${expectedEvent} event from the configured registry`);
  }

  const parsed = matches[0];
  if (!parsed) throw new Error('Source event could not be decoded');
  return {
    eventName: parsed.name,
    sessionId: String(parsed.args.sessionId),
    coverageId: String(parsed.args.coverageId),
  };
}
