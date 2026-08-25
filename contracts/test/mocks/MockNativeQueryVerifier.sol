// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { INativeQueryVerifier } from "../../src/interfaces/INativeQueryVerifier.sol";

contract MockNativeQueryVerifier is INativeQueryVerifier {
    bool public result = true;

    function setResult(bool nextResult) external {
        result = nextResult;
    }

    function verifyAndEmit(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external view returns (bool) {
        return result;
    }
}
