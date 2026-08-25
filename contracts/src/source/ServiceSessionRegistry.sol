// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { TutelaTypes } from "../libraries/TutelaTypes.sol";
import {
    ZeroAddress,
    InvalidAmount,
    InvalidDeadline,
    InvalidNonce,
    InvalidSignature,
    Unauthorized,
    SessionAlreadyExists,
    SessionNotActive,
    CoverageAlreadyUsed,
    ServiceBelowMinimum,
    ReceiptOutsideWindow,
    DeadlineNotReached
} from "../libraries/TutelaErrors.sol";

/// @title ServiceSessionRegistry
/// @notice Records deterministic DePIN service outcomes on a supported Attestcoin source chain.
/// @dev The registry validates signed evidence. It does not independently prove physical delivery.
contract ServiceSessionRegistry is EIP712 {
    bytes32 public constant SESSION_AUTHORIZATION_TYPEHASH = keccak256(
        "SessionAuthorization(bytes32 coverageId,bytes32 programId,address operator,address customer,address device,uint64 deadline,uint128 minimumUnits,bytes32 termsHash,uint256 nonce)"
    );
    bytes32 public constant SERVICE_RECEIPT_TYPEHASH = keccak256(
        "ServiceReceipt(bytes32 sessionId,bytes32 coverageId,uint128 deliveredUnits,uint64 completedAt,uint256 nonce)"
    );

    mapping(bytes32 sessionId => TutelaTypes.Session) public sessions;
    mapping(bytes32 coverageId => bytes32 sessionId) public coverageSession;
    mapping(address customer => uint256 nonce) public authorizationNonces;

    event SessionOpened(
        bytes32 indexed sessionId,
        bytes32 indexed coverageId,
        bytes32 indexed programId,
        address operator,
        address customer,
        address device,
        uint64 deadline,
        uint128 minimumUnits,
        bytes32 termsHash
    );
    event SessionSettled(
        bytes32 indexed sessionId,
        bytes32 indexed coverageId,
        uint128 deliveredUnits,
        uint64 completedAt,
        bytes32 receiptHash
    );
    event SessionFailed(bytes32 indexed sessionId, bytes32 indexed coverageId, uint64 deadline);

    constructor() EIP712("Tutela Service Session", "1") { }

    function openSession(TutelaTypes.SessionTerms calldata terms, bytes calldata customerSignature)
        external
        returns (bytes32 sessionId)
    {
        _validateTerms(terms);
        if (msg.sender != terms.device) revert Unauthorized();

        uint256 expectedNonce = authorizationNonces[terms.customer];
        if (terms.nonce != expectedNonce) revert InvalidNonce(expectedNonce, terms.nonce);

        bytes32 digest = sessionAuthorizationDigest(terms);
        if (ECDSA.recoverCalldata(digest, customerSignature) != terms.customer) {
            revert InvalidSignature();
        }

        sessionId = computeSessionId(terms);
        if (sessions[sessionId].status != TutelaTypes.SessionStatus.None) {
            revert SessionAlreadyExists(sessionId);
        }
        if (coverageSession[terms.coverageId] != bytes32(0)) {
            revert CoverageAlreadyUsed(terms.coverageId);
        }

        authorizationNonces[terms.customer] = expectedNonce + 1;
        coverageSession[terms.coverageId] = sessionId;
        sessions[sessionId] = TutelaTypes.Session({
            coverageId: terms.coverageId,
            programId: terms.programId,
            operator: terms.operator,
            customer: terms.customer,
            device: terms.device,
            openedAt: uint64(block.timestamp),
            deadline: terms.deadline,
            minimumUnits: terms.minimumUnits,
            termsHash: terms.termsHash,
            receiptNonce: 0,
            status: TutelaTypes.SessionStatus.Active
        });

        emit SessionOpened(
            sessionId,
            terms.coverageId,
            terms.programId,
            terms.operator,
            terms.customer,
            terms.device,
            terms.deadline,
            terms.minimumUnits,
            terms.termsHash
        );
    }

    function settleSession(
        TutelaTypes.ServiceReceipt calldata receipt,
        bytes calldata deviceSignature
    ) external {
        TutelaTypes.Session storage session = sessions[receipt.sessionId];
        if (session.status != TutelaTypes.SessionStatus.Active) {
            revert SessionNotActive(receipt.sessionId);
        }
        if (receipt.coverageId != session.coverageId) revert InvalidSignature();
        if (receipt.nonce != session.receiptNonce) {
            revert InvalidNonce(session.receiptNonce, receipt.nonce);
        }
        if (receipt.deliveredUnits < session.minimumUnits) {
            revert ServiceBelowMinimum(session.minimumUnits, receipt.deliveredUnits);
        }
        if (
            block.timestamp > session.deadline || receipt.completedAt < session.openedAt
                || receipt.completedAt > session.deadline || receipt.completedAt > block.timestamp
        ) revert ReceiptOutsideWindow();

        bytes32 digest = serviceReceiptDigest(receipt);
        if (ECDSA.recoverCalldata(digest, deviceSignature) != session.device) {
            revert InvalidSignature();
        }

        session.receiptNonce += 1;
        session.status = TutelaTypes.SessionStatus.Settled;
        emit SessionSettled(
            receipt.sessionId,
            receipt.coverageId,
            receipt.deliveredUnits,
            receipt.completedAt,
            keccak256(abi.encode(receipt))
        );
    }

    function finalizeFailed(bytes32 sessionId) external {
        TutelaTypes.Session storage session = sessions[sessionId];
        if (session.status != TutelaTypes.SessionStatus.Active) revert SessionNotActive(sessionId);
        if (block.timestamp <= session.deadline) revert DeadlineNotReached(session.deadline);

        session.status = TutelaTypes.SessionStatus.Failed;
        emit SessionFailed(sessionId, session.coverageId, session.deadline);
    }

    function getSession(bytes32 sessionId) external view returns (TutelaTypes.Session memory) {
        return sessions[sessionId];
    }

    function computeSessionId(TutelaTypes.SessionTerms calldata terms)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                address(this),
                block.chainid,
                terms.coverageId,
                terms.programId,
                terms.customer,
                terms.device,
                terms.nonce
            )
        );
    }

    function sessionAuthorizationDigest(TutelaTypes.SessionTerms calldata terms)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SESSION_AUTHORIZATION_TYPEHASH,
                    terms.coverageId,
                    terms.programId,
                    terms.operator,
                    terms.customer,
                    terms.device,
                    terms.deadline,
                    terms.minimumUnits,
                    terms.termsHash,
                    terms.nonce
                )
            )
        );
    }

    function serviceReceiptDigest(TutelaTypes.ServiceReceipt calldata receipt)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SERVICE_RECEIPT_TYPEHASH,
                    receipt.sessionId,
                    receipt.coverageId,
                    receipt.deliveredUnits,
                    receipt.completedAt,
                    receipt.nonce
                )
            )
        );
    }

    function _validateTerms(TutelaTypes.SessionTerms calldata terms) private view {
        if (
            terms.operator == address(0) || terms.customer == address(0)
                || terms.device == address(0)
        ) revert ZeroAddress();
        if (
            terms.coverageId == bytes32(0) || terms.programId == bytes32(0)
                || terms.termsHash == bytes32(0)
        ) {
            revert InvalidAmount();
        }
        if (terms.minimumUnits == 0) revert InvalidAmount();
        if (terms.deadline <= block.timestamp) revert InvalidDeadline();
    }
}
