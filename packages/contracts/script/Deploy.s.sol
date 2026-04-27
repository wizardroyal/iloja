// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {DocumentRegistry} from "../src/DocumentRegistry.sol";

/**
 * @notice Deploys DocumentRegistry to Base. The deployer key (PRIVATE_KEY env)
 *         becomes the initial anchor — usually the same key the worker uses
 *         to submit anchor txs.
 *
 *         forge script script/Deploy.s.sol --rpc-url base --broadcast
 */
contract Deploy is Script {
    function run() external returns (DocumentRegistry registry) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address anchor = vm.envOr("ANCHOR_ADDRESS", vm.addr(pk));
        vm.startBroadcast(pk);
        registry = new DocumentRegistry(anchor);
        vm.stopBroadcast();
    }
}
