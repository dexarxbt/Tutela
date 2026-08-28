import { z } from 'zod';

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const positiveInteger = z.number().int().nonnegative();

export const contractDeploymentSchema = z.object({
  name: z.string().min(1),
  address: address.optional(),
  deploymentTransaction: hash.optional(),
  deploymentBlock: positiveInteger.optional(),
  deployer: address.optional(),
  bytecodeHash: hash.optional(),
  explorerUrl: z.url().optional(),
  constructorArguments: z.array(z.string()).default([]),
});

export const deploymentManifestSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    status: z.enum(['pending', 'deployed']),
    network: z.string().min(1),
    chainId: positiveInteger,
    chainKey: positiveInteger.optional(),
    generatedAt: z.iso.datetime().optional(),
    gitCommit: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    infrastructure: z
      .object({
        chainInfoPrecompile: address.optional(),
        blockProverPrecompile: address.optional(),
        evmDecoder: address.optional(),
      })
      .optional(),
    contracts: z.array(contractDeploymentSchema),
  })
  .superRefine((manifest, context) => {
    if (manifest.status !== 'deployed') return;
    for (const [index, contract] of manifest.contracts.entries()) {
      for (const field of [
        'address',
        'deploymentTransaction',
        'deploymentBlock',
        'deployer',
        'bytecodeHash',
        'explorerUrl',
      ] as const) {
        if (contract[field] === undefined) {
          context.addIssue({
            code: 'custom',
            path: ['contracts', index, field],
            message: `${field} is required for deployed contracts`,
          });
        }
      }
    }
  });

const chainEvidenceSchema = z.object({
  chainId: positiveInteger,
  chainKey: positiveInteger.optional(),
  contract: address,
  transactionHash: hash,
  blockNumber: positiveInteger,
  explorerUrl: z.url(),
});

export const evidenceManifestSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    status: z.enum(['pending', 'verified']),
    outcome: z.enum(['success', 'failure']),
    protocolCommit: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    coverageId: hash.optional(),
    sessionId: hash.optional(),
    programId: hash.optional(),
    source: chainEvidenceSchema.optional(),
    destination: chainEvidenceSchema.optional(),
    semantics: z
      .object({
        customer: address,
        operator: address,
        device: address,
        deadline: positiveInteger,
        minimumUnits: z.string().regex(/^\d+$/),
        deliveredUnits: z.string().regex(/^\d+$/).optional(),
        termsHash: hash,
      })
      .optional(),
    balanceEffects: z
      .object({
        operatorBondBefore: z.string().regex(/^\d+$/),
        operatorBondAfter: z.string().regex(/^\d+$/),
        customerClaimableBefore: z.string().regex(/^\d+$/),
        customerClaimableAfter: z.string().regex(/^\d+$/),
      })
      .optional(),
  })
  .superRefine((evidence, context) => {
    if (evidence.status !== 'verified') return;
    for (const field of [
      'protocolCommit',
      'coverageId',
      'sessionId',
      'programId',
      'source',
      'destination',
      'semantics',
      'balanceEffects',
    ] as const) {
      if (evidence[field] === undefined) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required for verified evidence`,
        });
      }
    }
  });

export type DeploymentManifest = z.infer<typeof deploymentManifestSchema>;
export type EvidenceManifest = z.infer<typeof evidenceManifestSchema>;
export type VerifiedEvidenceManifest = EvidenceManifest & {
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
