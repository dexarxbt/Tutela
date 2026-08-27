// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { TutelaVault } from "../../src/cc3/TutelaVault.sol";
import { TutelaTypes } from "../../src/libraries/TutelaTypes.sol";
import { MockNativeQueryVerifier } from "../mocks/MockNativeQueryVerifier.sol";

contract VaultAccountingHandler is Test {
    TutelaVault public immutable vault;
    bytes32 public programId;
    bytes32[] public coverageIds;

    constructor(TutelaVault vault_) {
        vault = vault_;
    }

    receive() external payable { }

    function initialize() external payable {
        if (programId != bytes32(0)) return;
        programId = vault.createProgram{ value: msg.value }(
            address(0x53A710),
            address(0xD3A1C3),
            1,
            0.1 ether,
            5 ether,
            1 hours,
            25_000,
            keccak256("invariant-terms")
        );
    }

    function deposit(uint96 rawAmount) external {
        uint256 amount = bound(rawAmount, 1, 25 ether);
        vm.deal(address(this), address(this).balance + amount);
        vault.depositBond{ value: amount }(programId);
    }

    function reserve() external {
        if (vault.availableBond(programId) < 5 ether) return;
        vm.deal(address(this), address(this).balance + 0.1 ether);
        bytes32 coverageId = vault.reserveCoverage{ value: 0.1 ether }(programId);
        coverageIds.push(coverageId);
    }

    function cancel(uint256 seed) external {
        if (coverageIds.length == 0) return;
        bytes32 coverageId = coverageIds[seed % coverageIds.length];
        TutelaTypes.Coverage memory coverage = vault.getCoverage(coverageId);
        if (coverage.status != TutelaTypes.CoverageStatus.Reserved) return;
        vault.cancelCoverage(coverageId);
    }

    function queueWithdrawal(uint96 rawAmount) external {
        uint256 available = vault.availableBond(programId);
        if (available == 0) return;
        vault.queueBondWithdrawal(programId, bound(rawAmount, 1, available));
    }

    function withdraw() external {
        if (vault.claimable(address(this)) == 0) return;
        vault.withdraw();
    }
}

contract VaultAccountingInvariantTest is StdInvariant, Test {
    TutelaVault internal vault;
    VaultAccountingHandler internal handler;
    bytes32 internal programId;

    function setUp() public {
        MockNativeQueryVerifier verifier = new MockNativeQueryVerifier();
        vault = new TutelaVault(address(verifier));
        handler = new VaultAccountingHandler(vault);
        vm.deal(address(handler), 50 ether);
        handler.initialize{ value: 50 ether }();
        programId = handler.programId();
        targetContract(address(handler));
    }

    function invariant_ReservedBondNeverExceedsTotalBond() public view {
        TutelaTypes.Program memory program = vault.getProgram(programId);
        assertLe(program.reservedBond, program.totalBond);
    }

    function invariant_VaultRemainsSolventForProgramAndQueuedClaims() public view {
        TutelaTypes.Program memory program = vault.getProgram(programId);
        assertGe(address(vault).balance, program.totalBond + vault.claimable(address(handler)));
    }
}
