// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

error ZeroAddress();
error InvalidAmount();
error InvalidDeadline();
error InvalidDuration();
error InvalidNonce(uint256 expected, uint256 received);
error InvalidSignature();
error Unauthorized();
error SessionAlreadyExists(bytes32 sessionId);
error SessionNotActive(bytes32 sessionId);
error CoverageAlreadyUsed(bytes32 coverageId);
error CoverageNotFound(bytes32 coverageId);
error CoverageStateInvalid(bytes32 coverageId, uint8 expected, uint8 actual);
error ProgramNotFound(bytes32 programId);
error ProgramInactive(bytes32 programId);
error InsufficientAvailableBond(uint256 available, uint256 required);
error IncorrectPremium(uint256 expected, uint256 received);
error ServiceBelowMinimum(uint256 minimum, uint256 delivered);
error ReceiptOutsideWindow();
error DeadlineNotReached(uint64 deadline);
error ProofAlreadyConsumed(bytes32 proofId);
error ProofVerificationFailed();
error InvalidSourceChain(uint64 expected, uint64 received);
error InvalidSourceTransaction();
error InvalidSourceEvent();
error TransferFailed();
error NothingToWithdraw();
