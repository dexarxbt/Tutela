export const serviceSessionRegistryAbi = [
  'event SessionOpened(bytes32 indexed sessionId, bytes32 indexed coverageId, bytes32 indexed programId, address operator, address customer, address device, uint64 deadline, uint128 minimumUnits, bytes32 termsHash)',
  'event SessionSettled(bytes32 indexed sessionId, bytes32 indexed coverageId, uint128 deliveredUnits, uint64 completedAt, bytes32 receiptHash)',
  'event SessionFailed(bytes32 indexed sessionId, bytes32 indexed coverageId, uint64 deadline)',
  'function authorizationNonces(address customer) view returns (uint256)',
  'function openSession((bytes32 coverageId,bytes32 programId,address operator,address customer,address device,uint64 deadline,uint128 minimumUnits,bytes32 termsHash,uint256 nonce) terms, bytes customerSignature) returns (bytes32 sessionId)',
  'function settleSession((bytes32 sessionId,bytes32 coverageId,uint128 deliveredUnits,uint64 completedAt,uint256 nonce) receipt, bytes deviceSignature)',
  'function finalizeFailed(bytes32 sessionId)',
] as const;

export const tutelaVaultAbi = [
  'event ProgramCreated(bytes32 indexed programId,address indexed operator,address indexed sourceRegistry,address device,uint64 sourceChainKey,uint128 premium,uint128 failurePayout,uint64 sessionDuration,uint128 minimumUnits,bytes32 termsHash,uint256 initialBond)',
  'event CoverageReserved(bytes32 indexed coverageId,bytes32 indexed programId,address indexed customer,uint64 deadline,uint128 premium,uint128 payout)',
  'event CoverageActivated(bytes32 indexed coverageId,bytes32 indexed sessionId,bytes32 proofId)',
  'event ServiceProved(bytes32 indexed coverageId,bytes32 indexed sessionId,uint128 deliveredUnits,bytes32 receiptHash,bytes32 proofId)',
  'event FailurePaid(bytes32 indexed coverageId,bytes32 indexed sessionId,uint256 compensation,bytes32 proofId)',
  'function createProgram(address sourceRegistry,address device,uint64 sourceChainKey,uint128 premium,uint128 failurePayout,uint64 sessionDuration,uint128 minimumUnits,bytes32 termsHash) payable returns (bytes32)',
  'function depositBond(bytes32 programId) payable',
  'function reserveCoverage(bytes32 programId) payable returns (bytes32)',
  'function cancelCoverage(bytes32 coverageId)',
  'function submitProof(uint8 action,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) returns (bytes32)',
  'function withdraw()',
  'function availableBond(bytes32 programId) view returns (uint256)',
  'function claimable(address account) view returns (uint256)',
  'function getProgram(bytes32 programId) view returns ((address operator,address device,address sourceRegistry,uint64 sourceChainKey,uint256 totalBond,uint256 reservedBond,uint128 premium,uint128 failurePayout,uint64 sessionDuration,uint128 minimumUnits,bytes32 termsHash,bool active))',
  'function getCoverage(bytes32 coverageId) view returns ((bytes32 programId,bytes32 sessionId,address operator,address customer,address device,address sourceRegistry,uint64 sourceChainKey,uint64 deadline,uint128 premium,uint128 payout,uint128 minimumUnits,bytes32 termsHash,bytes32 sourceProofId,uint8 status))',
] as const;
