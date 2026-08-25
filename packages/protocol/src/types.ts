export enum SessionStatus {
  None,
  Active,
  Settled,
  Failed,
}

export enum CoverageStatus {
  None,
  Reserved,
  Active,
  Succeeded,
  Compensated,
  Cancelled,
}

export enum ProofAction {
  Activate,
  SettleSuccess,
  SettleFailure,
}

export type Outcome = 'success' | 'failure';
export type DeploymentStatus = 'pending' | 'deployed';
export type EvidenceStatus = 'pending' | 'verified';

export interface ProgramView {
  id: string;
  name: string;
  operator: string;
  device: string;
  sourceRegistry: string;
  sourceChainKey: number;
  totalBond: bigint;
  reservedBond: bigint;
  premium: bigint;
  failurePayout: bigint;
  sessionDuration: number;
  minimumUnits: bigint;
  termsHash: string;
  active: boolean;
}

export interface CoverageView {
  id: string;
  programId: string;
  sessionId: string;
  operator: string;
  customer: string;
  status: CoverageStatus;
  premium: bigint;
  payout: bigint;
  deadline: number;
  minimumUnits: bigint;
  termsHash: string;
  sourceProofId: string;
}
