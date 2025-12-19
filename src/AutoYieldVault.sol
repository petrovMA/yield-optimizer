// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AutoYieldVault
 * @notice Receives cross-chain callbacks from SchedulerRSC to trigger yield optimization
 * @dev MVP version: Only emits events when rebalancing is triggered
 *      Future versions will implement actual APY checking and fund rebalancing
 */
contract AutoYieldVault {
    // ========== STATE VARIABLES ==========

    /// @notice Contract owner with administrative privileges
    address public owner;

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

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ========== ERRORS ==========

    /// @notice Thrown when caller is not authorized
    error Unauthorized(address caller);

    /// @notice Thrown when zero address is provided
    error InvalidAddress(address addr);

    // ========== MODIFIERS ==========

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }

    // ========== CONSTRUCTOR ==========

    /**
     * @notice Initializes the vault with deployer as owner
     * @dev Payable to allow funding the contract during deployment
     */
    constructor() payable {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ========== CORE FUNCTIONS ==========

    /**
     * @notice Called by SchedulerRSC or anyone to trigger rebalancing check
     * @dev MVP: Only emits event to demonstrate cross-chain callback works
     *      Future: Will check APYs across pools and rebalance funds if profitable
     */
    function checkAndRebalance() external {
        emit RebalancingTriggered(msg.sender, block.timestamp, block.number);

        // Future implementation:
        // 1. Query APY from AAVEPoolMock: mockAAVEPool.getReserveData(asset)
        // 2. Query APY from SparkPoolMock: mockSparkPool.getReserveData(asset)
        // 3. Compare APYs and determine if rebalancing is profitable
        // 4. If profitable: withdraw from lower APY pool
        // 5. If profitable: deposit to higher APY pool
        // 6. Emit detailed rebalancing event with amounts and pools
    }

    // ========== ADMINISTRATIVE FUNCTIONS ==========

    /**
     * @notice Transfers ownership to a new address
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAddress(_newOwner);

        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
}
