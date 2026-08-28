import { evidenceManifestSchema, type VerifiedEvidenceManifest } from '@tutela/protocol';

type EvidenceRecord = {
  file: string;
  path: string;
  evidence: VerifiedEvidenceManifest;
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
  source: VerifiedEvidenceManifest['source'];
  destination: VerifiedEvidenceManifest['destination'];
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

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function evidenceFile(path: string) {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? path;
}

function formatIssues(file: string, evidence: unknown) {
  const result = evidenceManifestSchema.safeParse(evidence);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
    .join('; ');
  throw new Error(`evidence/${file}: ${issues}`);
}

function assertUnique(records: EvidenceRecord[]) {
  const fields = [
    ['coverage ID', (record: EvidenceRecord) => record.evidence.coverageId],
    ['session ID', (record: EvidenceRecord) => record.evidence.sessionId],
    ['source transaction', (record: EvidenceRecord) => record.evidence.source.transactionHash],
    [
      'destination transaction',
      (record: EvidenceRecord) => record.evidence.destination.transactionHash,
    ],
  ] as const;

  for (const [label, select] of fields) {
    const seen = new Map<string, string>();
    for (const record of records) {
      const value = select(record).toLowerCase();
      const duplicate = seen.get(value);
      if (duplicate) {
        throw new Error(
          `evidence/${record.file}: duplicate ${label} also appears in evidence/${duplicate}`
        );
      }
      seen.set(value, record.file);
    }
  }
}

function assertConsistentProgram(records: EvidenceRecord[]) {
  const reference = records[0]!;
  const sameHex = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  for (const record of records.slice(1)) {
    const current = record.evidence;
    const expected = reference.evidence;
    if (
      !sameHex(current.protocolCommit, expected.protocolCommit) ||
      !sameHex(current.programId, expected.programId) ||
      !sameHex(current.semantics.operator, expected.semantics.operator) ||
      !sameHex(current.semantics.customer, expected.semantics.customer) ||
      !sameHex(current.semantics.device, expected.semantics.device) ||
      !sameHex(current.semantics.termsHash, expected.semantics.termsHash) ||
      current.semantics.minimumUnits !== expected.semantics.minimumUnits
    ) {
      throw new Error(
        `evidence/${record.file}: manifest does not describe the same deployed program as evidence/${reference.file}`
      );
    }
  }
}

function loadEvidenceCollection(): EvidenceRecord[] {
  const modules = import.meta.glob('../../../evidence/*.json', {
    eager: true,
    import: 'default',
  }) as Record<string, unknown>;
  const parsed = Object.entries(modules)
    .sort(([left], [right]) => compareText(left, right))
    .map(([path, input]) => ({
      path,
      file: evidenceFile(path),
      evidence: formatIssues(evidenceFile(path), input),
    }));

  if (parsed.length === 0) throw new Error('No evidence manifests were discovered');
  const status = parsed[0]!.evidence.status;
  const differentStatus = parsed.find((record) => record.evidence.status !== status);
  if (differentStatus) {
    throw new Error(
      `evidence/${differentStatus.file}: evidence manifests must be all pending or all verified`
    );
  }
  if (status !== 'verified') throw new Error('Verified evidence is unavailable');

  const records = parsed as EvidenceRecord[];
  assertUnique(records);
  assertConsistentProgram(records);
  return records;
}

function featuredRecord(records: EvidenceRecord[], file: string, outcome: 'success' | 'failure') {
  const record = records.find((candidate) => candidate.file === file);
  if (!record) throw new Error(`evidence/${file}: featured evidence manifest is unavailable`);
  if (record.evidence.outcome !== outcome) {
    throw new Error(`evidence/${file}: outcome must be ${outcome}`);
  }
  return record;
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

function deriveEconomics(evidence: VerifiedEvidenceManifest) {
  const operatorBondDelta =
    BigInt(evidence.balanceEffects.operatorBondBefore) -
    BigInt(evidence.balanceEffects.operatorBondAfter);
  const customerCredit =
    BigInt(evidence.balanceEffects.customerClaimableAfter) -
    BigInt(evidence.balanceEffects.customerClaimableBefore);
  if (operatorBondDelta < 0n || customerCredit <= 0n) {
    throw new Error('Verified evidence contains invalid balance effects');
  }
  if (evidence.outcome === 'success') {
    if (operatorBondDelta !== 0n)
      throw new Error('Verified success evidence consumes operator bond');
    return { premium: customerCredit, payout: 0n, customerCredit };
  }
  if (operatorBondDelta <= 0n || customerCredit <= operatorBondDelta) {
    throw new Error('Verified failure evidence has invalid payout or premium refund effects');
  }
  return {
    premium: customerCredit - operatorBondDelta,
    payout: operatorBondDelta,
    customerCredit,
  };
}

function toLifecycle(evidence: VerifiedEvidenceManifest): VerifiedLifecycle {
  const success = evidence.outcome === 'success';
  const economics = deriveEconomics(evidence);
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
    premium: formatCtcWei(economics.premium),
    payout: formatCtcWei(economics.payout),
    customerCredit: formatCtcWei(economics.customerCredit),
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

const evidenceRecords = loadEvidenceCollection();
const lifecycleRecords = evidenceRecords.map((record) => ({
  ...record,
  lifecycle: toLifecycle(record.evidence),
}));
const featuredSuccess = featuredRecord(evidenceRecords, 'success.json', 'success');
const featuredFailure = featuredRecord(evidenceRecords, 'failure.json', 'failure');

export const successfulLifecycle = lifecycleRecords.find(
  (record) => record.path === featuredSuccess.path
)!.lifecycle;
export const failedLifecycle = lifecycleRecords.find(
  (record) => record.path === featuredFailure.path
)!.lifecycle;
export const coverages = lifecycleRecords
  .toSorted(
    (left, right) =>
      right.lifecycle.destination.blockNumber - left.lifecycle.destination.blockNumber ||
      compareText(left.path, right.path)
  )
  .map((record) => record.lifecycle);
export const evidenceCounts = {
  total: coverages.length,
  success: coverages.filter((coverage) => coverage.outcome === 'success').length,
  failure: coverages.filter((coverage) => coverage.outcome === 'failure').length,
};
export const publishedTransactionCount = 2 + evidenceCounts.total * 2;

const successEffects = featuredSuccess.evidence.balanceEffects;
const failureEffects = featuredFailure.evidence.balanceEffects;
const featuredSuccessEconomics = deriveEconomics(featuredSuccess.evidence);
const featuredFailureEconomics = deriveEconomics(featuredFailure.evidence);

export const verifiedProgram = {
  id: featuredSuccess.evidence.programId,
  name: 'Tutela live warranty',
  operator: featuredSuccess.evidence.semantics.operator,
  device: featuredSuccess.evidence.semantics.device,
  sourceRegistry: featuredSuccess.evidence.source.contract,
  sourceChainKey: featuredSuccess.evidence.source.chainKey,
  lifecycleCount: coverages.length,
  initialBond: formatCtcWei(successEffects.operatorBondBefore),
  recordedBond: formatCtcWei(failureEffects.operatorBondAfter),
  payout: formatCtcWei(featuredFailureEconomics.payout),
  premium: formatCtcWei(featuredSuccessEconomics.premium),
  minimumUnits: `${featuredSuccess.evidence.semantics.minimumUnits} raw unit`,
  termsHash: featuredSuccess.evidence.semantics.termsHash,
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
