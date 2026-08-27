import type { EvidenceManifest } from '@tutela/protocol';
import failureManifest from '../../../evidence/failure.json';
import successManifest from '../../../evidence/success.json';

type VerifiedEvidence = EvidenceManifest & {
  status: 'verified';
  coverageId: string;
  sessionId: string;
  programId: string;
  protocolCommit: string;
  source: NonNullable<EvidenceManifest['source']>;
  destination: NonNullable<EvidenceManifest['destination']>;
  semantics: NonNullable<EvidenceManifest['semantics']>;
  balanceEffects: NonNullable<EvidenceManifest['balanceEffects']>;
};

export type VerifiedLifecycle = {
  id: string;
  sessionId: string;
  programId: string;
  programName: string;
  route: string;
  customer: string;
  operator: string;
  device: string;
  status: 'service-proved' | 'failure-paid';
  statusLabel: 'Verified success' | 'Verified failure';
  outcome: 'success' | 'failure';
  premium: string;
  payout: string;
  customerCredit: string;
  minimumUnits: string;
  deliveredUnits: string | null;
  deadline: string;
  deadlineTimestamp: number;
  termsHash: string;
  protocolCommit: string;
  source: VerifiedEvidence['source'];
  destination: VerifiedEvidence['destination'];
  operatorBondBefore: string;
  operatorBondAfter: string;
  customerClaimableBefore: string;
  customerClaimableAfter: string;
};

export const sourceRegistryAddress =
  import.meta.env.VITE_SOURCE_REGISTRY_ADDRESS ?? '0x6ecA894E12cE5d498e9b55fD4cFc246995494577';
export const tutelaVaultAddress =
  import.meta.env.VITE_TUTELA_VAULT_ADDRESS ?? '0x6ecA894E12cE5d498e9b55fD4cFc246995494577';
export const deploymentReady = Boolean(sourceRegistryAddress && tutelaVaultAddress);

function requireVerified(input: unknown, outcome: 'success' | 'failure'): VerifiedEvidence {
  const evidence = input as Partial<VerifiedEvidence>;
  if (
    evidence.status !== 'verified' ||
    evidence.outcome !== outcome ||
    !evidence.coverageId ||
    !evidence.sessionId ||
    !evidence.programId ||
    !evidence.protocolCommit ||
    !evidence.source ||
    !evidence.destination ||
    !evidence.semantics ||
    !evidence.balanceEffects
  ) {
    throw new Error(`Verified ${outcome} evidence is unavailable`);
  }
  return evidence as VerifiedEvidence;
}

export function formatCtcWei(value: string | bigint) {
  const amount = BigInt(value);
  const scale = 10n ** 18n;
  const whole = amount / scale;
  const remainder = amount % scale;
  if (remainder === 0n) return `${whole} CTC`;
  const fraction = remainder.toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}.${fraction} CTC`;
}

export function shortHash(value: string, start = 10, end = 8) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export function formatDeadline(timestamp: number) {
  return `${new Date(timestamp * 1_000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const successEvidence = requireVerified(successManifest, 'success');
const failureEvidence = requireVerified(failureManifest, 'failure');
const successEffects = successEvidence.balanceEffects;
const failureEffects = failureEvidence.balanceEffects;
const premiumWei =
  BigInt(successEffects.customerClaimableAfter) - BigInt(successEffects.customerClaimableBefore);
const payoutWei =
  BigInt(failureEffects.operatorBondBefore) - BigInt(failureEffects.operatorBondAfter);
const failureCreditWei =
  BigInt(failureEffects.customerClaimableAfter) - BigInt(failureEffects.customerClaimableBefore);
const premiumRefundWei = failureCreditWei - payoutWei;

function toLifecycle(evidence: VerifiedEvidence): VerifiedLifecycle {
  const success = evidence.outcome === 'success';
  return {
    id: evidence.coverageId,
    sessionId: evidence.sessionId,
    programId: evidence.programId,
    programName: 'Tutela live warranty',
    route: 'Ethereum Sepolia → Creditcoin CC3',
    customer: evidence.semantics.customer,
    operator: evidence.semantics.operator,
    device: evidence.semantics.device,
    status: success ? 'service-proved' : 'failure-paid',
    statusLabel: success ? 'Verified success' : 'Verified failure',
    outcome: evidence.outcome,
    premium: formatCtcWei(success ? premiumWei : premiumRefundWei),
    payout: formatCtcWei(payoutWei),
    customerCredit: formatCtcWei(success ? premiumWei : failureCreditWei),
    minimumUnits: `${evidence.semantics.minimumUnits} raw unit`,
    deliveredUnits: evidence.semantics.deliveredUnits
      ? `${evidence.semantics.deliveredUnits} raw unit`
      : null,
    deadline: formatDeadline(evidence.semantics.deadline),
    deadlineTimestamp: evidence.semantics.deadline,
    termsHash: evidence.semantics.termsHash,
    protocolCommit: evidence.protocolCommit,
    source: evidence.source,
    destination: evidence.destination,
    operatorBondBefore: formatCtcWei(evidence.balanceEffects.operatorBondBefore),
    operatorBondAfter: formatCtcWei(evidence.balanceEffects.operatorBondAfter),
    customerClaimableBefore: formatCtcWei(evidence.balanceEffects.customerClaimableBefore),
    customerClaimableAfter: formatCtcWei(evidence.balanceEffects.customerClaimableAfter),
  };
}

export const successfulLifecycle = toLifecycle(successEvidence);
export const failedLifecycle = toLifecycle(failureEvidence);
export const coverages = [failedLifecycle, successfulLifecycle].sort(
  (left, right) => right.destination.blockNumber - left.destination.blockNumber
);

export const verifiedProgram = {
  id: successEvidence.programId,
  name: 'Tutela live warranty',
  operator: successEvidence.semantics.operator,
  device: successEvidence.semantics.device,
  sourceRegistry: successEvidence.source.contract,
  sourceChainKey: successEvidence.source.chainKey,
  lifecycleCount: coverages.length,
  initialBond: formatCtcWei(successEffects.operatorBondBefore),
  recordedBond: formatCtcWei(failureEffects.operatorBondAfter),
  payout: formatCtcWei(payoutWei),
  premium: formatCtcWei(premiumWei),
  minimumUnits: `${successEvidence.semantics.minimumUnits} raw unit`,
  termsHash: successEvidence.semantics.termsHash,
};

export const activity = coverages.map((coverage) => ({
  action: coverage.outcome === 'success' ? 'Success proof settled' : 'Failure proof settled',
  coverage: coverage.id,
  detail:
    coverage.outcome === 'success'
      ? `${coverage.deliveredUnits} verified; operator premium credited`
      : `${coverage.customerCredit} credited after deterministic expiry`,
  time: `CC3 block ${coverage.destination.blockNumber.toLocaleString('en-US')}`,
  tone: coverage.outcome === 'success' ? ('success' as const) : ('paid' as const),
  explorerUrl: coverage.destination.explorerUrl,
}));

export function findCoverage(id?: string) {
  return coverages.find((coverage) => coverage.id.toLowerCase() === id?.toLowerCase());
}
