// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { ServiceSessionRegistry } from "../../src/source/ServiceSessionRegistry.sol";
import { TutelaTypes } from "../../src/libraries/TutelaTypes.sol";
import {
    Unauthorized,
    InvalidSignature,
    InvalidNonce,
    CoverageAlreadyUsed,
    SessionNotActive,
    ServiceBelowMinimum,
    DeadlineNotReached
} from "../../src/libraries/TutelaErrors.sol";

contract ServiceSessionRegistryTest is Test {
    ServiceSessionRegistry internal registry;

    uint256 internal constant CUSTOMER_KEY = 0xC0570;
    uint256 internal constant DEVICE_KEY = 0xD3A1C3;
    uint256 internal constant ATTACKER_KEY = 0xBAD;
    address internal customer;
    address internal device;
    address internal operator = address(0x0A11CE);

    bytes32 internal constant COVERAGE_ID = keccak256("coverage-1");
    bytes32 internal constant PROGRAM_ID = keccak256("program-1");
    bytes32 internal constant TERMS_HASH = keccak256("5 CTC payout / 0.1 CTC premium");

    function setUp() public {
        vm.warp(1_800_000_000);
        registry = new ServiceSessionRegistry();
        customer = vm.addr(CUSTOMER_KEY);
        device = vm.addr(DEVICE_KEY);
    }

    function test_OpenSessionWithCustomerAuthorization() public {
        TutelaTypes.SessionTerms memory terms = _terms();
        bytes memory signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));

        vm.prank(device);
        bytes32 sessionId = registry.openSession(terms, signature);

        TutelaTypes.Session memory session = registry.getSession(sessionId);
        assertEq(session.coverageId, COVERAGE_ID);
        assertEq(session.customer, customer);
        assertEq(session.device, device);
        assertEq(uint8(session.status), uint8(TutelaTypes.SessionStatus.Active));
        assertEq(registry.authorizationNonces(customer), 1);
        assertEq(registry.coverageSession(COVERAGE_ID), sessionId);
    }

    function test_RejectsActivationFromAnyoneExceptDevice() public {
        TutelaTypes.SessionTerms memory terms = _terms();
        bytes memory signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));

        vm.expectRevert(Unauthorized.selector);
        vm.prank(customer);
        registry.openSession(terms, signature);
    }

    function test_RejectsWrongCustomerSignature() public {
        TutelaTypes.SessionTerms memory terms = _terms();
        bytes memory signature = _sign(ATTACKER_KEY, registry.sessionAuthorizationDigest(terms));

        vm.expectRevert(InvalidSignature.selector);
        vm.prank(device);
        registry.openSession(terms, signature);
    }

    function test_RejectsAuthorizationNonceReplay() public {
        TutelaTypes.SessionTerms memory terms = _terms();
        bytes memory signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));
        vm.prank(device);
        registry.openSession(terms, signature);

        terms.coverageId = keccak256("coverage-2");
        signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));
        vm.expectRevert(abi.encodeWithSelector(InvalidNonce.selector, 1, 0));
        vm.prank(device);
        registry.openSession(terms, signature);
    }

    function test_RejectsCoverageReuseEvenWithFreshNonce() public {
        TutelaTypes.SessionTerms memory terms = _terms();
        bytes memory signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));
        vm.prank(device);
        registry.openSession(terms, signature);

        terms.nonce = 1;
        signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));
        vm.expectRevert(abi.encodeWithSelector(CoverageAlreadyUsed.selector, COVERAGE_ID));
        vm.prank(device);
        registry.openSession(terms, signature);
    }

    function test_DeviceReceiptSettlesSession() public {
        bytes32 sessionId = _open();
        TutelaTypes.ServiceReceipt memory receipt = TutelaTypes.ServiceReceipt({
            sessionId: sessionId,
            coverageId: COVERAGE_ID,
            deliveredUnits: 32_500,
            completedAt: uint64(block.timestamp),
            nonce: 0
        });

        registry.settleSession(receipt, _sign(DEVICE_KEY, registry.serviceReceiptDigest(receipt)));

        TutelaTypes.Session memory session = registry.getSession(sessionId);
        assertEq(uint8(session.status), uint8(TutelaTypes.SessionStatus.Settled));
        assertEq(session.receiptNonce, 1);
    }

    function testFuzz_RejectsDeliveryBelowMinimum(uint128 deliveredUnits) public {
        deliveredUnits = uint128(bound(deliveredUnits, 0, 24_999));
        bytes32 sessionId = _open();
        TutelaTypes.ServiceReceipt memory receipt = TutelaTypes.ServiceReceipt({
            sessionId: sessionId,
            coverageId: COVERAGE_ID,
            deliveredUnits: deliveredUnits,
            completedAt: uint64(block.timestamp),
            nonce: 0
        });

        bytes memory signature = _sign(DEVICE_KEY, registry.serviceReceiptDigest(receipt));
        vm.expectRevert(
            abi.encodeWithSelector(ServiceBelowMinimum.selector, 25_000, deliveredUnits)
        );
        registry.settleSession(receipt, signature);
    }

    function test_FailureIsPermissionlessAfterDeadline() public {
        bytes32 sessionId = _open();
        TutelaTypes.Session memory session = registry.getSession(sessionId);

        vm.expectRevert(abi.encodeWithSelector(DeadlineNotReached.selector, session.deadline));
        registry.finalizeFailed(sessionId);

        vm.warp(session.deadline + 1);
        vm.prank(address(0xB0B));
        registry.finalizeFailed(sessionId);

        assertEq(
            uint8(registry.getSession(sessionId).status), uint8(TutelaTypes.SessionStatus.Failed)
        );
    }

    function test_TerminalSessionCannotBeFinalizedAgain() public {
        bytes32 sessionId = _open();
        TutelaTypes.Session memory session = registry.getSession(sessionId);
        vm.warp(session.deadline + 1);
        registry.finalizeFailed(sessionId);

        vm.expectRevert(abi.encodeWithSelector(SessionNotActive.selector, sessionId));
        registry.finalizeFailed(sessionId);
    }

    function _open() internal returns (bytes32 sessionId) {
        TutelaTypes.SessionTerms memory terms = _terms();
        bytes memory signature = _sign(CUSTOMER_KEY, registry.sessionAuthorizationDigest(terms));
        vm.prank(device);
        sessionId = registry.openSession(terms, signature);
    }

    function _terms() internal view returns (TutelaTypes.SessionTerms memory) {
        return TutelaTypes.SessionTerms({
            coverageId: COVERAGE_ID,
            programId: PROGRAM_ID,
            operator: operator,
            customer: customer,
            device: device,
            deadline: uint64(block.timestamp + 1 hours),
            minimumUnits: 25_000,
            termsHash: TERMS_HASH,
            nonce: 0
        });
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
