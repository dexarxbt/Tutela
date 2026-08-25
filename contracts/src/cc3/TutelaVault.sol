// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EvmV1Decoder } from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import { INativeQueryVerifier } from "../interfaces/INativeQueryVerifier.sol";
import { TutelaTypes } from "../libraries/TutelaTypes.sol";
import {
    ZeroAddress,
    InvalidAmount,
    InvalidDuration,
    Unauthorized,
    CoverageNotFound,
    CoverageStateInvalid,
    ProgramNotFound,
    ProgramInactive,
    InsufficientAvailableBond,
    IncorrectPremium,
    ServiceBelowMinimum,
    ProofAlreadyConsumed,
    ProofVerificationFailed,
    InvalidSourceChain,
    InvalidSourceTransaction,
    InvalidSourceEvent,
    TransferFailed,
    NothingToWithdraw
} from "../libraries/TutelaErrors.sol";

/// @title TutelaVault
/// @notice CTC-collateralized protection settled from Attestcoin-verified service outcomes.
contract TutelaVault is ReentrancyGuard {
    uint64 public constant MAX_SESSION_DURATION = 30 days;
    bytes32 public constant SESSION_OPENED_SIGNATURE = keccak256(
        "SessionOpened(bytes32,bytes32,bytes32,address,address,address,uint64,uint128,bytes32)"
    );
    bytes32 public constant SESSION_SETTLED_SIGNATURE =
        keccak256("SessionSettled(bytes32,bytes32,uint128,uint64,bytes32)");
    bytes32 public constant SESSION_FAILED_SIGNATURE =
        keccak256("SessionFailed(bytes32,bytes32,uint64)");

    INativeQueryVerifier public immutable verifier;

    mapping(bytes32 programId => TutelaTypes.Program) public programs;
    mapping(bytes32 coverageId => TutelaTypes.Coverage) public coverages;
    mapping(bytes32 proofId => bool) public consumedProofs;
    mapping(address account => uint256) public claimable;
    mapping(address operator => uint256) public programNonces;
    mapping(address customer => uint256) public coverageNonces;

    event ProgramCreated(
        bytes32 indexed programId,
        address indexed operator,
        address indexed sourceRegistry,
        address device,
        uint64 sourceChainKey,
        uint128 premium,
        uint128 failurePayout,
        uint64 sessionDuration,
        uint128 minimumUnits,
        bytes32 termsHash,
        uint256 initialBond
    );
    event ProgramStatusChanged(bytes32 indexed programId, bool active);
    event BondDeposited(bytes32 indexed programId, uint256 amount, uint256 totalBond);
    event BondWithdrawalQueued(bytes32 indexed programId, address indexed operator, uint256 amount);
    event CoverageReserved(
        bytes32 indexed coverageId,
        bytes32 indexed programId,
        address indexed customer,
        uint64 deadline,
        uint128 premium,
        uint128 payout
    );
    event CoverageCancelled(bytes32 indexed coverageId);
    event CoverageActivated(bytes32 indexed coverageId, bytes32 indexed sessionId, bytes32 proofId);
    event ServiceProved(
        bytes32 indexed coverageId,
        bytes32 indexed sessionId,
        uint128 deliveredUnits,
        bytes32 receiptHash,
        bytes32 proofId
    );
    event FailurePaid(
        bytes32 indexed coverageId, bytes32 indexed sessionId, uint256 compensation, bytes32 proofId
    );
    event ProofConsumed(
        bytes32 indexed proofId, bytes32 indexed coverageId, TutelaTypes.ProofAction action
    );
    event Withdrawal(address indexed account, uint256 amount);

    constructor(address verifierAddress) {
        if (verifierAddress == address(0)) revert ZeroAddress();
        verifier = INativeQueryVerifier(verifierAddress);
    }

    function createProgram(
        address sourceRegistry,
        address device,
        uint64 sourceChainKey,
        uint128 premium,
        uint128 failurePayout,
        uint64 sessionDuration,
        uint128 minimumUnits,
        bytes32 termsHash
    ) external payable returns (bytes32 programId) {
        if (sourceRegistry == address(0) || device == address(0)) {
            revert ZeroAddress();
        }
        if (
            sourceChainKey == 0 || premium == 0 || failurePayout == 0 || minimumUnits == 0
                || termsHash == bytes32(0)
        ) revert InvalidAmount();
        if (sessionDuration == 0 || sessionDuration > MAX_SESSION_DURATION) {
            revert InvalidDuration();
        }

        uint256 nonce = programNonces[msg.sender]++;
        programId = keccak256(abi.encode(address(this), block.chainid, msg.sender, nonce));
        programs[programId] = TutelaTypes.Program({
            operator: msg.sender,
            device: device,
            sourceRegistry: sourceRegistry,
            sourceChainKey: sourceChainKey,
            totalBond: msg.value,
            reservedBond: 0,
            premium: premium,
            failurePayout: failurePayout,
            sessionDuration: sessionDuration,
            minimumUnits: minimumUnits,
            termsHash: termsHash,
            active: true
        });

        emit ProgramCreated(
            programId,
            msg.sender,
            sourceRegistry,
            device,
            sourceChainKey,
            premium,
            failurePayout,
            sessionDuration,
            minimumUnits,
            termsHash,
            msg.value
        );
    }

    function setProgramActive(bytes32 programId, bool active) external {
        TutelaTypes.Program storage program = _program(programId);
        if (msg.sender != program.operator) revert Unauthorized();
        program.active = active;
        emit ProgramStatusChanged(programId, active);
    }

    function depositBond(bytes32 programId) external payable {
        if (msg.value == 0) revert InvalidAmount();
        TutelaTypes.Program storage program = _program(programId);
        program.totalBond += msg.value;
        emit BondDeposited(programId, msg.value, program.totalBond);
    }

    function queueBondWithdrawal(bytes32 programId, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        TutelaTypes.Program storage program = _program(programId);
        if (msg.sender != program.operator) revert Unauthorized();
        uint256 available = program.totalBond - program.reservedBond;
        if (amount > available) revert InsufficientAvailableBond(available, amount);

        program.totalBond -= amount;
        claimable[msg.sender] += amount;
        emit BondWithdrawalQueued(programId, msg.sender, amount);
    }

    function reserveCoverage(bytes32 programId) external payable returns (bytes32 coverageId) {
        TutelaTypes.Program storage program = _program(programId);
        if (!program.active) revert ProgramInactive(programId);
        if (msg.value != program.premium) revert IncorrectPremium(program.premium, msg.value);

        uint256 available = program.totalBond - program.reservedBond;
        if (available < program.failurePayout) {
            revert InsufficientAvailableBond(available, program.failurePayout);
        }

        uint256 nonce = coverageNonces[msg.sender]++;
        coverageId =
            keccak256(abi.encode(address(this), block.chainid, programId, msg.sender, nonce));
        uint64 deadline = uint64(block.timestamp) + program.sessionDuration;
        program.reservedBond += program.failurePayout;
        coverages[coverageId] = TutelaTypes.Coverage({
            programId: programId,
            sessionId: bytes32(0),
            operator: program.operator,
            customer: msg.sender,
            device: program.device,
            sourceRegistry: program.sourceRegistry,
            sourceChainKey: program.sourceChainKey,
            deadline: deadline,
            premium: program.premium,
            payout: program.failurePayout,
            minimumUnits: program.minimumUnits,
            termsHash: program.termsHash,
            sourceProofId: bytes32(0),
            status: TutelaTypes.CoverageStatus.Reserved
        });

        emit CoverageReserved(
            coverageId, programId, msg.sender, deadline, program.premium, program.failurePayout
        );
    }

    function cancelCoverage(bytes32 coverageId) external {
        TutelaTypes.Coverage storage coverage = _coverage(coverageId);
        if (msg.sender != coverage.customer) revert Unauthorized();
        _requireCoverageState(coverageId, coverage.status, TutelaTypes.CoverageStatus.Reserved);

        coverage.status = TutelaTypes.CoverageStatus.Cancelled;
        programs[coverage.programId].reservedBond -= coverage.payout;
        claimable[coverage.customer] += coverage.premium;
        emit CoverageCancelled(coverageId);
    }

    function submitProof(
        TutelaTypes.ProofAction action,
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (bytes32 coverageId) {
        bytes32 proofId = keccak256(
            abi.encode(chainKey, blockHeight, keccak256(encodedTransaction))
        );
        if (consumedProofs[proofId]) revert ProofAlreadyConsumed(proofId);

        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({ root: merkleRoot, siblings: siblings });
        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots
            });
        if (!verifier.verifyAndEmit(
                chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof
            )) {
            revert ProofVerificationFailed();
        }

        EvmV1Decoder.CommonTxFields memory transaction =
            EvmV1Decoder.decodeCommonTxFields(encodedTransaction);
        EvmV1Decoder.ReceiptFields memory receipt =
            EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (transaction.toIsNull || transaction.value != 0 || receipt.receiptStatus != 1) {
            revert InvalidSourceTransaction();
        }

        if (action == TutelaTypes.ProofAction.Activate) {
            coverageId = _activate(chainKey, transaction, receipt, proofId);
        } else if (action == TutelaTypes.ProofAction.SettleSuccess) {
            coverageId = _settleSuccess(chainKey, transaction, receipt, proofId);
        } else {
            coverageId = _settleFailure(chainKey, transaction, receipt, proofId);
        }

        consumedProofs[proofId] = true;
        coverages[coverageId].sourceProofId = proofId;
        emit ProofConsumed(proofId, coverageId, action);
    }

    function withdraw() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        claimable[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert TransferFailed();
        emit Withdrawal(msg.sender, amount);
    }

    function availableBond(bytes32 programId) external view returns (uint256) {
        TutelaTypes.Program storage program = _program(programId);
        return program.totalBond - program.reservedBond;
    }

    function getProgram(bytes32 programId) external view returns (TutelaTypes.Program memory) {
        return _program(programId);
    }

    function getCoverage(bytes32 coverageId) external view returns (TutelaTypes.Coverage memory) {
        return _coverage(coverageId);
    }

    function _activate(
        uint64 chainKey,
        EvmV1Decoder.CommonTxFields memory transaction,
        EvmV1Decoder.ReceiptFields memory receipt,
        bytes32 proofId
    ) private returns (bytes32 coverageId) {
        EvmV1Decoder.LogEntry memory log = _singleLog(receipt, SESSION_OPENED_SIGNATURE);
        if (log.topics.length != 4) revert InvalidSourceEvent();
        bytes32 sessionId = log.topics[1];
        coverageId = log.topics[2];
        bytes32 programId = log.topics[3];
        (
            address operator,
            address customer,
            address device,
            uint64 deadline,
            uint128 minimumUnits,
            bytes32 termsHash
        ) = abi.decode(log.data, (address, address, address, uint64, uint128, bytes32));

        TutelaTypes.Coverage storage coverage = _coverage(coverageId);
        _requireCoverageState(coverageId, coverage.status, TutelaTypes.CoverageStatus.Reserved);
        _validateSource(coverage, chainKey, transaction, log);
        if (
            transaction.from != coverage.device || programId != coverage.programId
                || operator != coverage.operator || customer != coverage.customer
                || device != coverage.device || deadline != coverage.deadline
                || minimumUnits != coverage.minimumUnits || termsHash != coverage.termsHash
                || sessionId == bytes32(0)
        ) revert InvalidSourceEvent();

        coverage.sessionId = sessionId;
        coverage.status = TutelaTypes.CoverageStatus.Active;
        emit CoverageActivated(coverageId, sessionId, proofId);
    }

    function _settleSuccess(
        uint64 chainKey,
        EvmV1Decoder.CommonTxFields memory transaction,
        EvmV1Decoder.ReceiptFields memory receipt,
        bytes32 proofId
    ) private returns (bytes32 coverageId) {
        EvmV1Decoder.LogEntry memory log = _singleLog(receipt, SESSION_SETTLED_SIGNATURE);
        if (log.topics.length != 3) revert InvalidSourceEvent();
        bytes32 sessionId = log.topics[1];
        coverageId = log.topics[2];
        (uint128 deliveredUnits, uint64 completedAt, bytes32 receiptHash) =
            abi.decode(log.data, (uint128, uint64, bytes32));

        TutelaTypes.Coverage storage coverage = _coverage(coverageId);
        _requireCoverageState(coverageId, coverage.status, TutelaTypes.CoverageStatus.Active);
        _validateSource(coverage, chainKey, transaction, log);
        if (
            sessionId != coverage.sessionId || completedAt > coverage.deadline
                || receiptHash == bytes32(0)
        ) revert InvalidSourceEvent();
        if (deliveredUnits < coverage.minimumUnits) {
            revert ServiceBelowMinimum(coverage.minimumUnits, deliveredUnits);
        }

        coverage.status = TutelaTypes.CoverageStatus.Succeeded;
        programs[coverage.programId].reservedBond -= coverage.payout;
        claimable[coverage.operator] += coverage.premium;
        emit ServiceProved(coverageId, sessionId, deliveredUnits, receiptHash, proofId);
    }

    function _settleFailure(
        uint64 chainKey,
        EvmV1Decoder.CommonTxFields memory transaction,
        EvmV1Decoder.ReceiptFields memory receipt,
        bytes32 proofId
    ) private returns (bytes32 coverageId) {
        EvmV1Decoder.LogEntry memory log = _singleLog(receipt, SESSION_FAILED_SIGNATURE);
        if (log.topics.length != 3) revert InvalidSourceEvent();
        bytes32 sessionId = log.topics[1];
        coverageId = log.topics[2];
        uint64 deadline = abi.decode(log.data, (uint64));

        TutelaTypes.Coverage storage coverage = _coverage(coverageId);
        _requireCoverageState(coverageId, coverage.status, TutelaTypes.CoverageStatus.Active);
        _validateSource(coverage, chainKey, transaction, log);
        if (sessionId != coverage.sessionId || deadline != coverage.deadline) {
            revert InvalidSourceEvent();
        }

        coverage.status = TutelaTypes.CoverageStatus.Compensated;
        TutelaTypes.Program storage program = programs[coverage.programId];
        program.reservedBond -= coverage.payout;
        program.totalBond -= coverage.payout;
        claimable[coverage.customer] += uint256(coverage.payout) + coverage.premium;
        emit FailurePaid(coverageId, sessionId, coverage.payout, proofId);
    }

    function _validateSource(
        TutelaTypes.Coverage storage coverage,
        uint64 chainKey,
        EvmV1Decoder.CommonTxFields memory transaction,
        EvmV1Decoder.LogEntry memory log
    ) private view {
        if (chainKey != coverage.sourceChainKey) {
            revert InvalidSourceChain(coverage.sourceChainKey, chainKey);
        }
        if (transaction.to != coverage.sourceRegistry || log.address_ != coverage.sourceRegistry) {
            revert InvalidSourceTransaction();
        }
    }

    function _singleLog(EvmV1Decoder.ReceiptFields memory receipt, bytes32 signature)
        private
        pure
        returns (EvmV1Decoder.LogEntry memory)
    {
        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, signature);
        if (logs.length != 1) revert InvalidSourceEvent();
        return logs[0];
    }

    function _program(bytes32 programId)
        private
        view
        returns (TutelaTypes.Program storage program)
    {
        program = programs[programId];
        if (program.operator == address(0)) revert ProgramNotFound(programId);
    }

    function _coverage(bytes32 coverageId)
        private
        view
        returns (TutelaTypes.Coverage storage coverage)
    {
        coverage = coverages[coverageId];
        if (coverage.customer == address(0)) revert CoverageNotFound(coverageId);
    }

    function _requireCoverageState(
        bytes32 coverageId,
        TutelaTypes.CoverageStatus actual,
        TutelaTypes.CoverageStatus expected
    ) private pure {
        if (actual != expected) {
            revert CoverageStateInvalid(coverageId, uint8(expected), uint8(actual));
        }
    }
}
