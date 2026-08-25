// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { TutelaVault } from "../src/cc3/TutelaVault.sol";

contract DeployCC3 is Script {
    address internal constant BLOCK_PROVER = 0x0000000000000000000000000000000000000FD2;

    function run() external returns (TutelaVault vault) {
        uint256 deployerKey = vm.envUint("CC3_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        vault = new TutelaVault(BLOCK_PROVER);
        vm.stopBroadcast();
        console2.log("TutelaVault", address(vault));
        console2.log("BlockProver", BLOCK_PROVER);
    }
}
