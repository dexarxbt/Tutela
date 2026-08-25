import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ATTESTCOIN,
  CHAIN_IDS,
  deploymentManifestSchema,
  type DeploymentManifest,
} from '../packages/protocol/src/index.ts';

const root = process.cwd();
const liveContractFields = [
  'address',
  'deploymentTransaction',
  'deploymentBlock',
  'deployer',
  'bytecodeHash',
  'explorerUrl',
] as const;

const expected = [
  {
    file: 'sepolia.json',
    network: 'ethereum-sepolia',
    chainId: CHAIN_IDS.sepolia,
    chainKey: ATTESTCOIN.expectedSepoliaChainKey,
    contract: 'ServiceSessionRegistry',
  },
  {
    file: 'cc3-testnet.json',
    network: 'creditcoin-cc3-testnet',
    chainId: CHAIN_IDS.cc3Testnet,
    contract: 'TutelaVault',
  },
] as const;

async function load(file: string): Promise<DeploymentManifest> {
  const path = resolve(root, 'deployments', file);
  const input: unknown = JSON.parse(await readFile(path, 'utf8'));
  const result = deploymentManifestSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `${file}: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`
    );
  }
  return result.data;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const specification of expected) {
  const manifest = await load(specification.file);
  assert(manifest.network === specification.network, `${specification.file}: unexpected network`);
  assert(manifest.chainId === specification.chainId, `${specification.file}: unexpected chain ID`);
  assert(
    manifest.contracts.length === 1,
    `${specification.file}: expected exactly one protocol contract`
  );
  assert(
    manifest.contracts[0]?.name === specification.contract,
    `${specification.file}: unexpected contract name`
  );

  if ('chainKey' in specification) {
    assert(
      manifest.chainKey === specification.chainKey,
      `${specification.file}: unexpected Attestcoin chain key`
    );
  }

  if (manifest.status === 'pending') {
    assert(
      manifest.generatedAt === undefined && manifest.gitCommit === undefined,
      `${specification.file}: pending manifests must not imply a generated deployment`
    );
    for (const contract of manifest.contracts) {
      for (const field of liveContractFields) {
        assert(
          contract[field] === undefined,
          `${specification.file}: pending contract must not contain ${field}`
        );
      }
    }
  } else {
    assert(
      Boolean(manifest.generatedAt),
      `${specification.file}: generatedAt is required after deployment`
    );
    assert(
      Boolean(manifest.gitCommit),
      `${specification.file}: gitCommit is required after deployment`
    );
    for (const contract of manifest.contracts) {
      assert(
        contract.address?.toLowerCase() !== '0x0000000000000000000000000000000000000000',
        `${specification.file}: zero contract address is forbidden`
      );
    }
  }

  if (specification.file === 'cc3-testnet.json') {
    const infrastructure = manifest.infrastructure;
    assert(
      infrastructure?.chainInfoPrecompile?.toLowerCase() ===
        ATTESTCOIN.chainInfoPrecompile.toLowerCase(),
      'cc3-testnet.json: incorrect ChainInfo precompile'
    );
    assert(
      infrastructure?.blockProverPrecompile?.toLowerCase() ===
        ATTESTCOIN.blockProverPrecompile.toLowerCase(),
      'cc3-testnet.json: incorrect BlockProver precompile'
    );
    assert(
      infrastructure?.evmDecoder?.toLowerCase() === ATTESTCOIN.evmDecoder.toLowerCase(),
      'cc3-testnet.json: incorrect EVM decoder'
    );
    assert(
      manifest.contracts[0]?.constructorArguments[0]?.toLowerCase() ===
        ATTESTCOIN.blockProverPrecompile.toLowerCase(),
      'cc3-testnet.json: vault constructor must use canonical BlockProver'
    );
  }

  console.log(`✓ deployments/${specification.file} (${manifest.status})`);
}
