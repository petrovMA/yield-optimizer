// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "reactive-lib/abstract-base/AbstractCallback.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title AutoYieldVault
 * @notice Receives cross-chain callbacks from SchedulerRSC to trigger yield optimization
 * @dev MVP version: Only emits events when rebalancing is triggered
 *      Future versions will implement actual APY checking and fund rebalancing
 */
contract AutoYieldVault is AbstractCallback, Ownable {

    // Future expansion (not used in MVP)
    // address public mockAAVEPool;
    // address public mockSparkPool;
    // address public asset;

    // ========== EVENTS ==========

    /// @notice Emitted when checkAndRebalance is called
    /// @param caller Address that triggered rebalancing
    /// @param timestamp Block timestamp when triggered
    /// @param blockNumber Block number when triggered
    event RebalancingTriggered(
        address indexed caller,
        uint256 indexed timestamp,
        uint256 blockNumber
    );

    // ========== ERRORS ==========

    /// @notice Thrown when caller is not authorized
    error Unauthorized(address caller);

    /// @notice Thrown when zero address is provided
    error InvalidAddress(address addr);

    // ========== CONSTRUCTOR ==========

    /**
     * @notice Initializes the vault with deployer as owner
     * @dev Payable to allow funding the contract during deployment
     */
    constructor(address _callbackProxy) AbstractCallback(_callbackProxy) Ownable(msg.sender) payable {

    }

    // ========== CORE FUNCTIONS ==========

    /**
     * @notice Called by SchedulerRSC via Reactive Network callback to trigger rebalancing check
     * @param _rvmId The RVM ID (ReactVM address) - automatically injected by Reactive Network
     * @dev MVP: Only emits event to demonstrate cross-chain callback works
     *      Future: Will check APYs across pools and rebalance funds if profitable
     *      IMPORTANT: First parameter must be address for Reactive Network callbacks!
     *      Reactive Network replaces first 160 bits with RVM ID automatically.
     */
    function checkAndRebalance(address _rvmId) external {
        emit RebalancingTriggered(_rvmId, block.timestamp, block.number);

        // Future implementation:
        // 1. Query APY from AAVEPoolMock: mockAAVEPool.getReserveData(asset)
        // 2. Query APY from SparkPoolMock: mockSparkPool.getReserveData(asset)
        // 3. Compare APYs and determine if rebalancing is profitable
        // 4. If profitable: withdraw from lower APY pool
        // 5. If profitable: deposit to higher APY pool
        // 6. Emit detailed rebalancing event with amounts and pools
    }
}
