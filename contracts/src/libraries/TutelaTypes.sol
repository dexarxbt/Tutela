// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library TutelaTypes {
    enum SessionStatus {
        None,
        Active,
        Settled,
        Failed
    }

    enum CoverageStatus {
        None,
        Reserved,
        Active,
        Succeeded,
        Compensated,
        Cancelled
    }

    enum ProofAction {
        Activate,
        SettleSuccess,
        SettleFailure
    }

    struct SessionTerms {
        bytes32 coverageId;
        bytes32 programId;
        address operator;
        address customer;
        address device;
        uint64 deadline;
        uint128 minimumUnits;
        bytes32 termsHash;
        uint256 nonce;
    }

    struct ServiceReceipt {
        bytes32 sessionId;
        bytes32 coverageId;
        uint128 deliveredUnits;
        uint64 completedAt;
        uint256 nonce;
    }

    struct Session {
        bytes32 coverageId;
        bytes32 programId;
        address operator;
        address customer;
        address device;
        uint64 openedAt;
        uint64 deadline;
        uint128 minimumUnits;
        bytes32 termsHash;
        uint256 receiptNonce;
        SessionStatus status;
    }

    struct Program {
        address operator;
        address device;
        address sourceRegistry;
        uint64 sourceChainKey;
        uint256 totalBond;
        uint256 reservedBond;
        uint128 premium;
        uint128 failurePayout;
        uint64 sessionDuration;
        uint128 minimumUnits;
        bytes32 termsHash;
        bool active;
    }

    struct Coverage {
        bytes32 programId;
        bytes32 sessionId;
        address operator;
        address customer;
        address device;
        address sourceRegistry;
        uint64 sourceChainKey;
        uint64 deadline;
        uint128 premium;
        uint128 payout;
        uint128 minimumUnits;
        bytes32 termsHash;
        bytes32 sourceProofId;
        CoverageStatus status;
    }
}
