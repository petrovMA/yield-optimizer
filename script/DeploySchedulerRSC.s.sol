// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SchedulerRSC} from "../src/SchedulerRSC.sol";

/**
 * @title DeploySchedulerRSC
 * @notice Deployment script for SchedulerRSC contract to Reactive Network
 * @dev This script deploys SchedulerRSC with configurable parameters
 *
 * Usage:
 *   forge script script/DeploySchedulerRSC.s.sol:DeploySchedulerRSC \
 *     --rpc-url reactive_lasna \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 *
 * Or using .env file:
 *   source .env
 *   forge script script/DeploySchedulerRSC.s.sol:DeploySchedulerRSC \
 *     --rpc-url reactive_lasna \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract DeploySchedulerRSC is Script {
    // Default values (can be overridden via environment variables)
    address public targetVault;
    uint256 public interval;
    address public deployer;

    function setUp() public {
        // Try to read from environment variables, fallback to defaults
        try vm.envAddress("TARGET_VAULT") returns (address vault) {
            targetVault = vault;
        } catch {
            // Default: placeholder address (MUST be changed before deployment)
            targetVault = address(0x0000000000000000000000000000000000000000);
            console.log("WARNING: Using default TARGET_VAULT address");
        }

        try vm.envUint("INTERVAL") returns (uint256 _interval) {
            interval = _interval;
        } catch {
            // Default: 1000 blocks (~2 hours)
            interval = 1000;
            console.log("Using default INTERVAL: 1000 blocks (~2 hours)");
        }

        // Get deployer address from private key
        deployer = vm.addr(vm.envUint("PRIVATE_KEY_REACTIVE"));
    }

    function run() public {
        // Validation
        require(
            targetVault != address(0),
            "TARGET_VAULT must be set! Use environment variable or update script."
        );
        require(
            interval == 100 || interval == 1000 || interval == 10000 || interval == 60000,
            "INTERVAL must be 100, 1000, 10000, or 60000"
        );

        console.log("=== SchedulerRSC Deployment ===");
        console.log("");
        console.log("Network: Reactive Lasna Testnet");
        console.log("RPC URL: https://lasna-rpc.rnk.dev/");
        console.log("Chain ID: 5318007");
        console.log("Explorer: https://lasna.reactscan.net");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Deployer Balance:", deployer.balance / 1e18, "REACT");
        console.log("");
        console.log("=== Deployment Parameters ===");
        console.log("Target Vault (Sepolia):", targetVault);
        console.log("Interval:", interval, "blocks");

        if (interval == 100) {
            console.log("  -> Every 100 blocks (~12 minutes)");
        } else if (interval == 1000) {
            console.log("  -> Every 1,000 blocks (~2 hours)");
        } else if (interval == 10000) {
            console.log("  -> Every 10,000 blocks (~28 hours)");
        } else if (interval == 60000) {
            console.log("  -> Every 60,000 blocks (~1 week via 6x Cron10000)");
        }
        console.log("");

        // Check balance
        require(deployer.balance > 0, "Deployer has no REACT tokens. Fund your account first.");

        console.log("Starting deployment...");
        console.log("");

        vm.startBroadcast();

        // Deploy SchedulerRSC with 1 REACT for subscription payment
        SchedulerRSC scheduler = new SchedulerRSC{value: 0.05 ether}(targetVault, interval);

        vm.stopBroadcast();

        // Note: subscribe() must be called separately after deployment
        console.log("");
        console.log("IMPORTANT: You must call subscribe() manually after deployment:");
        console.log("cast send", vm.toString(address(scheduler)), '"subscribe()" --rpc-url reactive_lasna --private-key $PRIVATE_KEY_REACTIVE');
        console.log("");

        console.log("=== Deployment Successful! ===");
        console.log("");
        console.log("SchedulerRSC Address:", address(scheduler));
        console.log("Owner:", scheduler.owner());
        console.log("Target Vault:", scheduler.targetVault());
        console.log("Interval:", scheduler.interval());
        console.log("Weekly Counter:", scheduler.weeklyCounter());
        console.log("Is Weekly Mode:", scheduler.isWeeklyMode());
        console.log("Subscribed:", scheduler.subscribed());
        console.log("");
        console.log("=== Next Steps ===");
        console.log("1. Save the contract address:", address(scheduler));
        console.log("2. Verify on explorer:", string.concat("https://lasna.reactscan.net/address/", vm.toString(address(scheduler))));
        console.log("3. Fund the contract with REACT tokens for callback gas");
        console.log("4. The scheduler will automatically start triggering callbacks");
        console.log("");
        console.log("=== Admin Functions (as owner) ===");
        console.log("Change interval:");
        console.log("  cast send", vm.toString(address(scheduler)), '"setInterval(uint256)" <NEW_INTERVAL> --rpc-url reactive_lasna --private-key $PRIVATE_KEY');
        console.log("");
        console.log("Change target vault:");
        console.log("  cast send", vm.toString(address(scheduler)), '"setTargetVault(address)" <NEW_VAULT> --rpc-url reactive_lasna --private-key $PRIVATE_KEY');
        console.log("");
        console.log("Reset weekly counter:");
        console.log("  cast send", vm.toString(address(scheduler)), '"resetWeeklyCounter()" --rpc-url reactive_lasna --private-key $PRIVATE_KEY');
        console.log("");
    }
}