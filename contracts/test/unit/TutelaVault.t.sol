// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { EvmV1Decoder } from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import { TutelaVault } from "../../src/cc3/TutelaVault.sol";
import { INativeQueryVerifier } from "../../src/interfaces/INativeQueryVerifier.sol";
import { TutelaTypes } from "../../src/libraries/TutelaTypes.sol";
import {
    Unauthorized,
    CoverageStateInvalid,
    InsufficientAvailableBond,
    ProofAlreadyConsumed,
    ProofVerificationFailed,
    InvalidSourceChain,
    InvalidSourceTransaction,
    InvalidSourceEvent
} from "../../src/libraries/TutelaErrors.sol";
import { MockNativeQueryVerifier } from "../mocks/MockNativeQueryVerifier.sol";

contract TutelaVaultTest is Test {
    MockNativeQueryVerifier internal verifier;
    TutelaVault internal vault;

    address internal operator = address(0x0A11CE);
    address internal customer = address(0xC0570);
    address internal device = address(0xD3A1C3);
    address internal registry = address(0x53A710);
    address internal attacker = address(0xBAD);

    uint64 internal constant CHAIN_KEY = 10;
    uint128 internal constant PREMIUM = 0.1 ether;
    uint128 internal constant PAYOUT = 5 ether;
    uint128 internal constant MINIMUM_UNITS = 25_000;
    bytes32 internal constant TERMS_HASH = keccak256("tutela-program-v1");

    bytes32 internal programId;
    bytes32 internal coverageId;
    bytes32 internal sessionId = keccak256("session-1");

    function setUp() public {
        vm.warp(1_800_000_000);
        verifier = new MockNativeQueryVerifier();
        vault = new TutelaVault(address(verifier));
        vm.deal(operator, 200 ether);
        vm.deal(customer, 10 ether);

        vm.prank(operator);
        programId = vault.createProgram{ value: 100 ether }(
            registry, device, CHAIN_KEY, PREMIUM, PAYOUT, 1 hours, MINIMUM_UNITS, TERMS_HASH
        );

        vm.prank(customer);
        coverageId = vault.reserveCoverage{ value: PREMIUM }(programId);
    }

    function test_ReservationLocksPayoutCollateral() public view {
        TutelaTypes.Program memory program = vault.getProgram(programId);
        TutelaTypes.Coverage memory coverage = vault.getCoverage(coverageId);

        assertEq(program.totalBond, 100 ether);
        assertEq(program.reservedBond, PAYOUT);
        assertEq(vault.availableBond(programId), 95 ether);
        assertEq(coverage.customer, customer);
        assertEq(coverage.deadline, block.timestamp + 1 hours);
        assertEq(uint8(coverage.status), uint8(TutelaTypes.CoverageStatus.Reserved));
    }

    function test_OperatorCannotWithdrawReservedBond() public {
        vm.expectRevert(
            abi.encodeWithSelector(InsufficientAvailableBond.selector, 95 ether, 96 ether)
        );
        vm.prank(operator);
        vault.queueBondWithdrawal(programId, 96 ether);
    }

    function test_CustomerCanCancelOnlyBeforeActivation() public {
        vm.prank(customer);
        vault.cancelCoverage(coverageId);

        TutelaTypes.Coverage memory coverage = vault.getCoverage(coverageId);
        assertEq(uint8(coverage.status), uint8(TutelaTypes.CoverageStatus.Cancelled));
        assertEq(vault.getProgram(programId).reservedBond, 0);
        assertEq(vault.claimable(customer), PREMIUM);

        vm.expectRevert(Unauthorized.selector);
        vm.prank(attacker);
        vault.cancelCoverage(coverageId);
    }

    function test_ActivationBindsExactSourceSession() public {
        bytes memory transaction = _openedTransaction(registry, customer, CHAIN_KEY);
        _submit(TutelaTypes.ProofAction.Activate, CHAIN_KEY, transaction, bytes32("opened"));

        TutelaTypes.Coverage memory coverage = vault.getCoverage(coverageId);
        assertEq(coverage.sessionId, sessionId);
        assertEq(uint8(coverage.status), uint8(TutelaTypes.CoverageStatus.Active));

        bytes32 proofId = keccak256(abi.encode(CHAIN_KEY, uint64(100), keccak256(transaction)));
        vm.expectRevert(abi.encodeWithSelector(ProofAlreadyConsumed.selector, proofId));
        _submit(TutelaTypes.ProofAction.Activate, CHAIN_KEY, transaction, bytes32("opened"));
    }

    function test_SuccessReleasesBondAndCreditsPremium() public {
        _activate();
        bytes memory transaction = _settledTransaction(registry, 32_500);
        _submit(TutelaTypes.ProofAction.SettleSuccess, CHAIN_KEY, transaction, bytes32("success"));

        TutelaTypes.Coverage memory coverage = vault.getCoverage(coverageId);
        TutelaTypes.Program memory program = vault.getProgram(programId);
        assertEq(uint8(coverage.status), uint8(TutelaTypes.CoverageStatus.Succeeded));
        assertEq(program.reservedBond, 0);
        assertEq(program.totalBond, 100 ether);
        assertEq(vault.claimable(operator), PREMIUM);
    }

    function test_FailureReducesBondAndCreditsCustomer() public {
        _activate();
        bytes memory transaction = _failedTransaction(registry);
        _submit(TutelaTypes.ProofAction.SettleFailure, CHAIN_KEY, transaction, bytes32("failure"));

        TutelaTypes.Coverage memory coverage = vault.getCoverage(coverageId);
        TutelaTypes.Program memory program = vault.getProgram(programId);
        assertEq(uint8(coverage.status), uint8(TutelaTypes.CoverageStatus.Compensated));
        assertEq(program.reservedBond, 0);
        assertEq(program.totalBond, 95 ether);
        assertEq(vault.claimable(customer), PAYOUT + PREMIUM);
    }

    function test_RejectsFailureAfterSuccess() public {
        _activate();
        _submit(
            TutelaTypes.ProofAction.SettleSuccess,
            CHAIN_KEY,
            _settledTransaction(registry, 32_500),
            bytes32("success")
        );

        bytes memory failureTransaction = _failedTransaction(registry);
        vm.expectRevert(
            abi.encodeWithSelector(
                CoverageStateInvalid.selector,
                coverageId,
                uint8(TutelaTypes.CoverageStatus.Active),
                uint8(TutelaTypes.CoverageStatus.Succeeded)
            )
        );
        _submit(
            TutelaTypes.ProofAction.SettleFailure, CHAIN_KEY, failureTransaction, bytes32("failure")
        );
    }

    function test_RejectsWrongSourceChain() public {
        bytes memory transaction = _openedTransaction(registry, customer, 30);
        vm.expectRevert(abi.encodeWithSelector(InvalidSourceChain.selector, CHAIN_KEY, 30));
        _submit(TutelaTypes.ProofAction.Activate, 30, transaction, bytes32("wrong-chain"));
    }

    function test_RejectsEventFromUnapprovedEmitter() public {
        bytes memory transaction = _openedTransaction(attacker, customer, CHAIN_KEY);
        vm.expectRevert(InvalidSourceTransaction.selector);
        _submit(TutelaTypes.ProofAction.Activate, CHAIN_KEY, transaction, bytes32("wrong-emitter"));
    }

    function test_RejectsActivationForWrongCustomer() public {
        bytes memory transaction = _openedTransaction(registry, attacker, CHAIN_KEY);
        vm.expectRevert(InvalidSourceEvent.selector);
        _submit(TutelaTypes.ProofAction.Activate, CHAIN_KEY, transaction, bytes32("wrong-customer"));
    }

    function test_RejectsCryptographicallyInvalidProof() public {
        bytes memory transaction = _openedTransaction(registry, customer, CHAIN_KEY);
        verifier.setResult(false);
        vm.expectRevert(ProofVerificationFailed.selector);
        _submit(TutelaTypes.ProofAction.Activate, CHAIN_KEY, transaction, bytes32("bad-proof"));
    }

    function test_WithdrawalUsesPullPayment() public {
        _activate();
        _submit(
            TutelaTypes.ProofAction.SettleSuccess,
            CHAIN_KEY,
            _settledTransaction(registry, 32_500),
            bytes32("success")
        );

        uint256 beforeBalance = operator.balance;
        vm.prank(operator);
        vault.withdraw();
        assertEq(operator.balance, beforeBalance + PREMIUM);
        assertEq(vault.claimable(operator), 0);
    }

    function _activate() internal {
        _submit(
            TutelaTypes.ProofAction.Activate,
            CHAIN_KEY,
            _openedTransaction(registry, customer, CHAIN_KEY),
            bytes32("opened")
        );
    }

    function _submit(
        TutelaTypes.ProofAction action,
        uint64 chainKey,
        bytes memory transaction,
        bytes32 merkleRoot
    ) internal {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings =
            new INativeQueryVerifier.MerkleProofEntry[](0);
        bytes32[] memory continuityRoots = new bytes32[](0);
        vault.submitProof(
            action, chainKey, 100, transaction, merkleRoot, siblings, bytes32(0), continuityRoots
        );
    }

    function _openedTransaction(address emitter, address eventCustomer, uint64)
        internal
        view
        returns (bytes memory)
    {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = vault.SESSION_OPENED_SIGNATURE();
        topics[1] = sessionId;
        topics[2] = coverageId;
        topics[3] = programId;
        bytes memory data = abi.encode(
            operator,
            eventCustomer,
            device,
            vault.getCoverage(coverageId).deadline,
            MINIMUM_UNITS,
            TERMS_HASH
        );
        return _encodedTransaction(device, registry, emitter, topics, data, 1);
    }

    function _settledTransaction(address emitter, uint128 deliveredUnits)
        internal
        view
        returns (bytes memory)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = vault.SESSION_SETTLED_SIGNATURE();
        topics[1] = sessionId;
        topics[2] = coverageId;
        bytes memory data =
            abi.encode(deliveredUnits, uint64(block.timestamp), keccak256("device-receipt"));
        return _encodedTransaction(device, registry, emitter, topics, data, 1);
    }

    function _failedTransaction(address emitter) internal view returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = vault.SESSION_FAILED_SIGNATURE();
        topics[1] = sessionId;
        topics[2] = coverageId;
        bytes memory data = abi.encode(vault.getCoverage(coverageId).deadline);
        return _encodedTransaction(attacker, registry, emitter, topics, data, 1);
    }

    function _encodedTransaction(
        address from,
        address to,
        address emitter,
        bytes32[] memory topics,
        bytes memory logData,
        uint8 receiptStatus
    ) internal pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(1), uint64(300_000), from, false, to, uint256(0), bytes(""));
        chunks[1] = bytes("");

        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({ address_: emitter, topics: topics, data: logData });
        chunks[2] = abi.encode(receiptStatus, uint64(100_000), logs, bytes(""));
        return abi.encode(uint8(2), chunks);
    }
}
