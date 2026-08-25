import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ATTESTCOIN,
  CHAIN_IDS,
  deploymentManifestSchema,
  evidenceManifestSchema,
  type DeploymentManifest,
  type EvidenceManifest,
} from '../packages/protocol/src/index.ts';

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

async function loadDeployment(file: string): Promise<DeploymentManifest> {
  const result = deploymentManifestSchema.safeParse(await readJson(`deployments/${file}`));
  if (!result.success) throw new Error(`${file}: deployment manifest is invalid`);
  return result.data;
}

const sourceDeployment = await loadDeployment('sepolia.json');
const destinationDeployment = await loadDeployment('cc3-testnet.json');

for (const outcome of ['success', 'failure'] as const) {
  const file = `evidence/${outcome}.json`;
  const input = await readJson(file);
  const result = evidenceManifestSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `${file}: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`
    );
  }
  const evidence: EvidenceManifest = result.data;
  assert(evidence.outcome === outcome, `${file}: outcome does not match filename`);

  if (evidence.status === 'pending') {
    const keys = Object.keys(input as Record<string, unknown>)
      .sort()
      .join(',');
    assert(
      keys === 'outcome,schemaVersion,status',
      `${file}: pending evidence must not contain fabricated identifiers or transactions`
    );
  } else {
    assert(
      sourceDeployment.status === 'deployed' && destinationDeployment.status === 'deployed',
      `${file}: verified evidence requires deployed contract manifests`
    );
    assert(evidence.source?.chainId === CHAIN_IDS.sepolia, `${file}: source must be Sepolia`);
    assert(
      evidence.source?.chainKey === ATTESTCOIN.expectedSepoliaChainKey,
      `${file}: incorrect source chain key`
    );
    assert(
      evidence.destination?.chainId === CHAIN_IDS.cc3Testnet,
      `${file}: destination must be Creditcoin CC3`
    );
    assert(
      evidence.source?.contract.toLowerCase() ===
        sourceDeployment.contracts[0]?.address?.toLowerCase(),
      `${file}: source contract differs from deployment`
    );
    assert(
      evidence.destination?.contract.toLowerCase() ===
        destinationDeployment.contracts[0]?.address?.toLowerCase(),
      `${file}: destination contract differs from deployment`
    );

    const semantics = evidence.semantics;
    const effects = evidence.balanceEffects;
    assert(semantics && effects, `${file}: semantics and effects are required`);
    if (outcome === 'success') {
      assert(semantics.deliveredUnits !== undefined, `${file}: success requires delivered units`);
      assert(
        BigInt(semantics.deliveredUnits) >= BigInt(semantics.minimumUnits),
        `${file}: delivered units are below the committed minimum`
      );
      assert(
        effects.operatorBondBefore === effects.operatorBondAfter,
        `${file}: success must not consume operator bond`
      );
      assert(
        effects.customerClaimableBefore === effects.customerClaimableAfter,
        `${file}: success must not credit customer compensation`
      );
    } else {
      assert(
        semantics.deliveredUnits === undefined,
        `${file}: deterministic failure must not claim delivered units`
      );
      assert(
        BigInt(effects.operatorBondAfter) < BigInt(effects.operatorBondBefore),
        `${file}: failure must consume operator bond`
      );
      assert(
        BigInt(effects.customerClaimableAfter) > BigInt(effects.customerClaimableBefore),
        `${file}: failure must credit the customer`
      );
    }
  }

  console.log(`✓ ${file} (${evidence.status})`);
}
