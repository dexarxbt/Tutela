// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ServiceSessionRegistry } from "../src/source/ServiceSessionRegistry.sol";

contract DeploySource is Script {
    function run() external returns (ServiceSessionRegistry registry) {
        uint256 deployerKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        registry = new ServiceSessionRegistry();
        vm.stopBroadcast();
        console2.log("ServiceSessionRegistry", address(registry));
    }
}
