import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  ATTESTCOIN,
  CHAIN_IDS,
  PUBLIC_RPCS,
  deploymentManifestSchema,
  type DeploymentManifest,
} from '../packages/protocol/src/index.ts';

const root = process.cwd();
const execFileAsync = promisify(execFile);
const VERIFIER_SELECTOR = '0x2b7ac3f3';
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
    artifact: 'contracts/out/ServiceSessionRegistry.sol/ServiceSessionRegistry.json',
    rpc: PUBLIC_RPCS.sepolia,
    explorerHost: 'sepolia.etherscan.io',
  },
  {
    file: 'cc3-testnet.json',
    network: 'creditcoin-cc3-testnet',
    chainId: CHAIN_IDS.cc3Testnet,
    contract: 'TutelaVault',
    artifact: 'contracts/out/TutelaVault.sol/TutelaVault.json',
    rpc: PUBLIC_RPCS.cc3Testnet,
    explorerHost: 'creditcoin-testnet.blockscout.com',
  },
] as const;

type RpcReceipt = {
  status: string;
  blockNumber: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
};

type RpcTransaction = {
  blockNumber: string | null;
  from: string;
  to: string | null;
  input: string;
};

type FoundryArtifact = { bytecode: { object: string } };

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

async function loadArtifact(path: string): Promise<FoundryArtifact> {
  const artifact = JSON.parse(await readFile(resolve(root, path), 'utf8')) as FoundryArtifact;
  assert(/^0x[0-9a-f]+$/i.test(artifact.bytecode.object), `${path}: creation bytecode missing`);
  return artifact;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equalHex(left: string | null | undefined, right: string) {
  return left?.toLowerCase() === right.toLowerCase();
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

const verifiedSourceRevisions = new Set<string>();
async function assertSourceRevision(commit: string, file: string) {
  if (verifiedSourceRevisions.has(commit)) return;
  try {
    await execFileAsync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root });
    await execFileAsync(
      'git',
      [
        'diff',
        '--quiet',
        commit,
        '--',
        'contracts/src',
        'contracts/foundry.toml',
        'contracts/remappings.txt',
      ],
      { cwd: root }
    );
  } catch {
    throw new Error(
      `${file}: deployed commit is unavailable or its contract source differs from this build`
    );
  }
  verifiedSourceRevisions.add(commit);
}

function constructorEncoding(manifest: DeploymentManifest, file: string) {
  if (file === 'sepolia.json') return '';
  const verifier = manifest.contracts[0]?.constructorArguments[0];
  assert(verifier !== undefined, `${file}: verifier constructor argument missing`);
  return verifier.slice(2).toLowerCase().padStart(64, '0');
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
      /^[a-f0-9]{40}$/.test(manifest.gitCommit ?? ''),
      `${specification.file}: gitCommit must be a full lowercase commit hash`
    );
    await assertSourceRevision(manifest.gitCommit!, specification.file);

    const contract = manifest.contracts[0]!;
    assert(
      !equalHex(contract.address, '0x0000000000000000000000000000000000000000'),
      `${specification.file}: zero contract address is forbidden`
    );
    assert(
      contract.explorerUrl ===
        `https://${specification.explorerHost}/tx/${contract.deploymentTransaction}`,
      `${specification.file}: deployment explorer URL is not exact`
    );

    const [receipt, transaction, runtimeCode, artifact] = await Promise.all([
      rpc<RpcReceipt>(specification.rpc, 'eth_getTransactionReceipt', [
        contract.deploymentTransaction,
      ]),
      rpc<RpcTransaction>(specification.rpc, 'eth_getTransactionByHash', [
        contract.deploymentTransaction,
      ]),
      rpc<string>(specification.rpc, 'eth_getCode', [contract.address, 'latest']),
      loadArtifact(specification.artifact),
    ]);
    assert(BigInt(receipt.status) === 1n, `${specification.file}: deployment reverted`);
    assert(
      Number(BigInt(receipt.blockNumber)) === contract.deploymentBlock,
      `${specification.file}: deployment block mismatch`
    );
    assert(
      transaction.blockNumber === receipt.blockNumber,
      `${specification.file}: transaction block mismatch`
    );
    assert(equalHex(receipt.from, contract.deployer!), `${specification.file}: deployer mismatch`);
    assert(
      equalHex(transaction.from, contract.deployer!),
      `${specification.file}: sender mismatch`
    );
    assert(
      receipt.to === null && transaction.to === null,
      `${specification.file}: deployment transaction is not contract creation`
    );
    assert(
      equalHex(receipt.contractAddress, contract.address!),
      `${specification.file}: created contract address mismatch`
    );

    const expectedCreationInput = `${artifact.bytecode.object}${constructorEncoding(
      manifest,
      specification.file
    )}`;
    assert(
      equalHex(transaction.input, expectedCreationInput),
      `${specification.file}: creation bytecode differs from the declared source revision`
    );
    assert(runtimeCode !== '0x', `${specification.file}: deployed runtime code is empty`);

    const runtimeHash = await rpc<string>(specification.rpc, 'web3_sha3', [runtimeCode]);
    assert(
      equalHex(runtimeHash, contract.bytecodeHash!),
      `${specification.file}: runtime bytecode hash mismatch`
    );

    if (specification.file === 'cc3-testnet.json') {
      const verifierResult = await rpc<string>(specification.rpc, 'eth_call', [
        { to: contract.address, data: VERIFIER_SELECTOR },
        'latest',
      ]);
      assert(
        equalHex(`0x${verifierResult.slice(-40)}`, ATTESTCOIN.blockProverPrecompile),
        'cc3-testnet.json: deployed vault verifier is not the canonical BlockProver'
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

  console.log(
    `✓ deployments/${specification.file} (${manifest.status}, source + creation + runtime verified)`
  );
}
