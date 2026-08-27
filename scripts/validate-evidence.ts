import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ATTESTCOIN,
  CHAIN_IDS,
  PUBLIC_RPCS,
  deploymentManifestSchema,
  evidenceManifestSchema,
  type DeploymentManifest,
  type EvidenceManifest,
} from '../packages/protocol/src/index.ts';

const root = process.cwd();
const GET_PROGRAM_SELECTOR = '0xb1ffb3d4';
const GET_COVERAGE_SELECTOR = '0x7d32605b';
const CLAIMABLE_SELECTOR = '0x402914f5';
const SOURCE_EVENT_TOPICS = {
  success: '0x56b9558086fd00a4f5e7f1efd4d6d8b1fcb98fa9f7623e5203f1efa5bc4932fa',
  failure: '0x436c03876c484c0905f2e1288f6c21a67c4cb09d2e3db34214a21dbafd5e3767',
} as const;
const DESTINATION_EVENT_TOPICS = {
  success: '0xeb3d353037d3925f23385e9b5ced0f0a060113e84f6c5996afebd631b37cdacb',
  failure: '0xb62b425ddab8ec1268730517f8579e4a562cf29ec7fa177a76b6850eb62224da',
} as const;

type VerifiedEvidence = EvidenceManifest & {
  status: 'verified';
  protocolCommit: string;
  coverageId: string;
  sessionId: string;
  programId: string;
  source: NonNullable<EvidenceManifest['source']>;
  destination: NonNullable<EvidenceManifest['destination']>;
  semantics: NonNullable<EvidenceManifest['semantics']>;
  balanceEffects: NonNullable<EvidenceManifest['balanceEffects']>;
};

type RpcLog = { address: string; topics: string[]; data: string };
type RpcReceipt = {
  status: string;
  blockNumber: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
  logs: RpcLog[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equalHex(left: string | null | undefined, right: string) {
  return left?.toLowerCase() === right.toLowerCase();
}

function quantity(value: number) {
  return `0x${value.toString(16)}`;
}

function words(data: string) {
  const body = data.startsWith('0x') ? data.slice(2) : data;
  assert(body.length % 64 === 0, 'RPC ABI result has an invalid word length');
  return Array.from({ length: body.length / 64 }, (_, index) =>
    body.slice(index * 64, index * 64 + 64)
  );
}

function wordBigInt(value: string) {
  return BigInt(`0x${value}`);
}

function wordAddress(value: string) {
  return `0x${value.slice(-40)}`;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  assert(response.ok, `${method}: RPC returned HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { code: number; message: string } };
  assert(!body.error, `${method}: RPC error ${body.error?.code} ${body.error?.message}`);
  assert(body.result !== undefined && body.result !== null, `${method}: RPC returned no result`);
  return body.result;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

async function loadDeployment(file: string): Promise<DeploymentManifest> {
  const result = deploymentManifestSchema.safeParse(await readJson(`deployments/${file}`));
  if (!result.success) throw new Error(`${file}: deployment manifest is invalid`);
  return result.data;
}

async function loadEvidence(outcome: 'success' | 'failure') {
  const file = `evidence/${outcome}.json`;
  const input = await readJson(file);
  const result = evidenceManifestSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `${file}: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`
    );
  }
  assert(result.data.outcome === outcome, `${file}: outcome does not match filename`);
  if (result.data.status === 'pending') {
    assert(
      Object.keys(input as Record<string, unknown>)
        .sort()
        .join(',') === 'outcome,schemaVersion,status',
      `${file}: pending evidence must not contain fabricated identifiers or transactions`
    );
    return result.data;
  }
  return result.data as VerifiedEvidence;
}

function assertExactExplorerUrl(
  value: string,
  expectedHost: string,
  transactionHash: string,
  label: string
) {
  const expected = `https://${expectedHost}/tx/${transactionHash}`;
  assert(value === expected, `${label}: explorer URL must be exactly ${expected}`);
}

function findSingleLog(receipt: RpcReceipt, address: string, topic: string, label: string) {
  const matching = receipt.logs.filter(
    (log) => equalHex(log.address, address) && equalHex(log.topics[0], topic)
  );
  assert(matching.length === 1, `${label}: expected exactly one matching event`);
  return matching[0]!;
}

async function callWords(to: string, data: string, block: number | 'latest') {
  const result = await rpc<string>(PUBLIC_RPCS.cc3Testnet, 'eth_call', [
    { to, data },
    block === 'latest' ? block : quantity(block),
  ]);
  return words(result);
}

function assertProgram(
  program: string[],
  evidence: VerifiedEvidence,
  expectedPremium: bigint,
  expectedPayout: bigint,
  label: string
) {
  assert(
    equalHex(wordAddress(program[0]!), evidence.semantics.operator),
    `${label}: operator mismatch`
  );
  assert(
    equalHex(wordAddress(program[1]!), evidence.semantics.device),
    `${label}: device mismatch`
  );
  assert(
    equalHex(wordAddress(program[2]!), evidence.source.contract),
    `${label}: registry mismatch`
  );
  assert(
    wordBigInt(program[3]!) === BigInt(evidence.source.chainKey!),
    `${label}: chain key mismatch`
  );
  assert(wordBigInt(program[6]!) === expectedPremium, `${label}: premium mismatch`);
  assert(wordBigInt(program[7]!) === expectedPayout, `${label}: payout mismatch`);
  assert(
    wordBigInt(program[9]!) === BigInt(evidence.semantics.minimumUnits),
    `${label}: minimum units mismatch`
  );
  assert(
    equalHex(`0x${program[10]}`, evidence.semantics.termsHash),
    `${label}: terms hash mismatch`
  );
}

async function validateLiveEvidence(
  evidence: VerifiedEvidence,
  sourceDeployment: DeploymentManifest,
  destinationDeployment: DeploymentManifest,
  expectedPremium: bigint,
  expectedPayout: bigint
) {
  const file = `evidence/${evidence.outcome}.json`;
  assert(evidence.source.chainId === CHAIN_IDS.sepolia, `${file}: source must be Sepolia`);
  assert(
    evidence.source.chainKey === ATTESTCOIN.expectedSepoliaChainKey,
    `${file}: incorrect source chain key`
  );
  assert(
    evidence.destination.chainId === CHAIN_IDS.cc3Testnet,
    `${file}: destination must be Creditcoin CC3`
  );
  assert(
    evidence.protocolCommit === sourceDeployment.gitCommit &&
      evidence.protocolCommit === destinationDeployment.gitCommit,
    `${file}: protocol commit must match both deployment manifests`
  );
  assert(
    equalHex(evidence.source.contract, sourceDeployment.contracts[0]?.address ?? ''),
    `${file}: source contract differs from deployment`
  );
  assert(
    equalHex(evidence.destination.contract, destinationDeployment.contracts[0]?.address ?? ''),
    `${file}: destination contract differs from deployment`
  );
  assertExactExplorerUrl(
    evidence.source.explorerUrl,
    'sepolia.etherscan.io',
    evidence.source.transactionHash,
    `${file}: source`
  );
  assertExactExplorerUrl(
    evidence.destination.explorerUrl,
    'creditcoin-testnet.blockscout.com',
    evidence.destination.transactionHash,
    `${file}: destination`
  );

  const [sourceReceipt, destinationReceipt] = await Promise.all([
    rpc<RpcReceipt>(PUBLIC_RPCS.sepolia, 'eth_getTransactionReceipt', [
      evidence.source.transactionHash,
    ]),
    rpc<RpcReceipt>(PUBLIC_RPCS.cc3Testnet, 'eth_getTransactionReceipt', [
      evidence.destination.transactionHash,
    ]),
  ]);
  assert(
    wordBigInt(sourceReceipt.status.slice(2).padStart(64, '0')) === 1n,
    `${file}: source reverted`
  );
  assert(
    Number(BigInt(sourceReceipt.blockNumber)) === evidence.source.blockNumber,
    `${file}: source block mismatch`
  );
  assert(equalHex(sourceReceipt.to, evidence.source.contract), `${file}: source target mismatch`);
  assert(
    wordBigInt(destinationReceipt.status.slice(2).padStart(64, '0')) === 1n,
    `${file}: destination reverted`
  );
  assert(
    Number(BigInt(destinationReceipt.blockNumber)) === evidence.destination.blockNumber,
    `${file}: destination block mismatch`
  );
  assert(
    equalHex(destinationReceipt.to, evidence.destination.contract),
    `${file}: destination target mismatch`
  );

  const sourceLog = findSingleLog(
    sourceReceipt,
    evidence.source.contract,
    SOURCE_EVENT_TOPICS[evidence.outcome],
    `${file}: source`
  );
  assert(equalHex(sourceLog.topics[1], evidence.sessionId), `${file}: source session mismatch`);
  assert(equalHex(sourceLog.topics[2], evidence.coverageId), `${file}: source coverage mismatch`);
  const sourceData = words(sourceLog.data);
  if (evidence.outcome === 'success') {
    assert(evidence.semantics.deliveredUnits !== undefined, `${file}: delivered units missing`);
    assert(
      wordBigInt(sourceData[0]!) === BigInt(evidence.semantics.deliveredUnits),
      `${file}: source delivered units mismatch`
    );
    assert(
      wordBigInt(sourceData[1]!) <= BigInt(evidence.semantics.deadline),
      `${file}: source completion exceeded deadline`
    );
  } else {
    assert(evidence.semantics.deliveredUnits === undefined, `${file}: failure claims delivery`);
    assert(
      wordBigInt(sourceData[0]!) === BigInt(evidence.semantics.deadline),
      `${file}: source deadline mismatch`
    );
  }

  const destinationLog = findSingleLog(
    destinationReceipt,
    evidence.destination.contract,
    DESTINATION_EVENT_TOPICS[evidence.outcome],
    `${file}: destination`
  );
  assert(
    equalHex(destinationLog.topics[1], evidence.coverageId),
    `${file}: destination coverage mismatch`
  );
  assert(
    equalHex(destinationLog.topics[2], evidence.sessionId),
    `${file}: destination session mismatch`
  );
  const destinationData = words(destinationLog.data);
  const destinationProofId =
    evidence.outcome === 'success' ? destinationData[2] : destinationData[1];
  if (evidence.outcome === 'success') {
    assert(
      wordBigInt(destinationData[0]!) === BigInt(evidence.semantics.deliveredUnits!),
      `${file}: destination delivered units mismatch`
    );
  } else {
    assert(
      wordBigInt(destinationData[0]!) === expectedPayout,
      `${file}: destination payout event mismatch`
    );
  }
  assert(destinationProofId !== undefined, `${file}: destination proof ID missing`);

  const attestationLog = destinationReceipt.logs.find((log) =>
    equalHex(log.address, ATTESTCOIN.blockProverPrecompile)
  );
  assert(attestationLog && attestationLog.topics.length >= 3, `${file}: attestation log missing`);
  assert(
    BigInt(attestationLog.topics[1]!) === BigInt(evidence.source.chainKey!),
    `${file}: attested chain key mismatch`
  );
  assert(
    BigInt(attestationLog.topics[2]!) === BigInt(evidence.source.blockNumber),
    `${file}: attested source block mismatch`
  );

  const programData = `${GET_PROGRAM_SELECTOR}${evidence.programId.slice(2)}`;
  const coverageData = `${GET_COVERAGE_SELECTOR}${evidence.coverageId.slice(2)}`;
  const claimableData = `${CLAIMABLE_SELECTOR}${evidence.semantics.customer.slice(2).padStart(64, '0')}`;
  const [programBefore, programAfter, coverage, claimableBefore, claimableAfter] =
    await Promise.all([
      callWords(evidence.destination.contract, programData, evidence.destination.blockNumber - 1),
      callWords(evidence.destination.contract, programData, evidence.destination.blockNumber),
      callWords(evidence.destination.contract, coverageData, evidence.destination.blockNumber),
      callWords(evidence.destination.contract, claimableData, evidence.destination.blockNumber - 1),
      callWords(evidence.destination.contract, claimableData, evidence.destination.blockNumber),
    ]);
  assertProgram(programAfter, evidence, expectedPremium, expectedPayout, `${file}: program`);
  assert(
    wordBigInt(programBefore[4]!) === BigInt(evidence.balanceEffects.operatorBondBefore),
    `${file}: operator bond before mismatch`
  );
  assert(
    wordBigInt(programAfter[4]!) === BigInt(evidence.balanceEffects.operatorBondAfter),
    `${file}: operator bond after mismatch`
  );
  assert(
    wordBigInt(claimableBefore[0]!) === BigInt(evidence.balanceEffects.customerClaimableBefore),
    `${file}: customer claimable before mismatch`
  );
  assert(
    wordBigInt(claimableAfter[0]!) === BigInt(evidence.balanceEffects.customerClaimableAfter),
    `${file}: customer claimable after mismatch`
  );

  assert(equalHex(`0x${coverage[0]}`, evidence.programId), `${file}: coverage program mismatch`);
  assert(equalHex(`0x${coverage[1]}`, evidence.sessionId), `${file}: coverage session mismatch`);
  assert(
    equalHex(wordAddress(coverage[2]!), evidence.semantics.operator),
    `${file}: coverage operator mismatch`
  );
  assert(
    equalHex(wordAddress(coverage[3]!), evidence.semantics.customer),
    `${file}: coverage customer mismatch`
  );
  assert(
    equalHex(wordAddress(coverage[4]!), evidence.semantics.device),
    `${file}: coverage device mismatch`
  );
  assert(
    equalHex(wordAddress(coverage[5]!), evidence.source.contract),
    `${file}: coverage registry mismatch`
  );
  assert(
    wordBigInt(coverage[6]!) === BigInt(evidence.source.chainKey!),
    `${file}: coverage chain key mismatch`
  );
  assert(
    wordBigInt(coverage[7]!) === BigInt(evidence.semantics.deadline),
    `${file}: coverage deadline mismatch`
  );
  assert(wordBigInt(coverage[8]!) === expectedPremium, `${file}: coverage premium mismatch`);
  assert(wordBigInt(coverage[9]!) === expectedPayout, `${file}: coverage payout mismatch`);
  assert(
    wordBigInt(coverage[10]!) === BigInt(evidence.semantics.minimumUnits),
    `${file}: coverage minimum mismatch`
  );
  assert(
    equalHex(`0x${coverage[11]}`, evidence.semantics.termsHash),
    `${file}: coverage terms mismatch`
  );
  assert(
    equalHex(`0x${coverage[12]}`, `0x${destinationProofId}`),
    `${file}: coverage proof ID mismatch`
  );
  assert(
    wordBigInt(coverage[13]!) === (evidence.outcome === 'success' ? 3n : 4n),
    `${file}: terminal coverage status mismatch`
  );

  console.log(`✓ ${file} (verified against live RPC receipts and historical state)`);
}

const sourceDeployment = await loadDeployment('sepolia.json');
const destinationDeployment = await loadDeployment('cc3-testnet.json');
assert(
  sourceDeployment.status === 'deployed' && destinationDeployment.status === 'deployed',
  'verified evidence requires deployed contract manifests'
);

const success = await loadEvidence('success');
const failure = await loadEvidence('failure');
assert(
  success.status === failure.status,
  'evidence manifests must both be pending or both be verified'
);
if (success.status === 'pending' && failure.status === 'pending') {
  console.log(`✓ evidence/success.json (${success.status})`);
  console.log(`✓ evidence/failure.json (${failure.status})`);
} else {
  for (const field of ['programId'] as const) {
    assert(success[field] === failure[field], `evidence manifests disagree on ${field}`);
  }
  assert(
    success.protocolCommit === failure.protocolCommit,
    'evidence manifests disagree on protocol commit'
  );
  assert(
    success.semantics.operator.toLowerCase() === failure.semantics.operator.toLowerCase() &&
      success.semantics.customer.toLowerCase() === failure.semantics.customer.toLowerCase() &&
      success.semantics.device.toLowerCase() === failure.semantics.device.toLowerCase() &&
      success.semantics.termsHash.toLowerCase() === failure.semantics.termsHash.toLowerCase() &&
      success.semantics.minimumUnits === failure.semantics.minimumUnits,
    'evidence manifests do not describe one consistent program'
  );

  const premium =
    BigInt(success.balanceEffects.customerClaimableAfter) -
    BigInt(success.balanceEffects.customerClaimableBefore);
  const payout =
    BigInt(failure.balanceEffects.operatorBondBefore) -
    BigInt(failure.balanceEffects.operatorBondAfter);
  const failureCredit =
    BigInt(failure.balanceEffects.customerClaimableAfter) -
    BigInt(failure.balanceEffects.customerClaimableBefore);
  assert(premium > 0n, 'success premium delta must be positive');
  assert(
    success.balanceEffects.operatorBondBefore === success.balanceEffects.operatorBondAfter,
    'success must not consume operator bond'
  );
  assert(payout > 0n, 'failure payout must consume operator bond');
  assert(
    failureCredit === payout + premium,
    'failure credit must equal payout plus premium refund'
  );
  assert(
    BigInt(success.semantics.deliveredUnits!) >= BigInt(success.semantics.minimumUnits),
    'success delivered units are below the committed minimum'
  );

  await validateLiveEvidence(success, sourceDeployment, destinationDeployment, premium, payout);
  await validateLiveEvidence(failure, sourceDeployment, destinationDeployment, premium, payout);
}
