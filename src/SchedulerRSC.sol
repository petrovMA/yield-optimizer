// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "reactive-lib/abstract-base/AbstractPausableReactive.sol";

/**
 * @title SchedulerRSC
 * @notice Reactive Smart Contract that acts as a cron job to periodically trigger
 *         the AutoYieldVault contract on Sepolia to check and rebalance funds.
 * @dev Supports intervals: 100 (12 min), 1000 (2 hrs), 10000 (28 hrs), 60000 (~1 week)
 *      The 60000 interval counts 6 occurrences of Cron10000 to achieve ~1 week.
 *      Supports pause/resume functionality via AbstractPausableReactive.
 */
contract SchedulerRSC is AbstractPausableReactive {
    // ========== CONSTANTS ==========

    // Sepolia testnet chain ID
    uint256 private constant SEPOLIA_CHAIN_ID = 11155111;

    // Topic0 hashes for Cron events (keccak256 of event signatures)
    uint256 private constant CRON100_TOPIC = 0xb49937fb8970e19fd46d48f7e3fb00d659deac0347f79cd7cb542f0fc1503c70;   // ~12 minutes
    uint256 private constant CRON1000_TOPIC = 0xe20b31294d84c3661ddc8f423abb9c70310d0cf172aa2714ead78029b325e3f4;  //  ~2 hours
    uint256 private constant CRON10000_TOPIC = 0xd214e1d84db704ed42d37f538ea9bf71e44ba28bc1cc088b2f5deca654677a56; // ~28 hours

    // Gas limit for callback transaction on destination chain
    uint64 private constant CALLBACK_GAS_LIMIT = 3000000;

    // Weekly counter threshold (6 * Cron10000 = ~1 week)
    uint256 private constant WEEKLY_ITERATIONS = 6;

    // ========== STATE VARIABLES ==========

    // Address of the AutoYieldVault contract on Sepolia
    address public targetVault;

    // Cron interval: 100, 1000, 10000, or 60000
    uint256 public interval;

    // Counter for weekly mode (60000 interval)
    // Increments on each Cron10000 event, resets after reaching WEEKLY_ITERATIONS
    uint256 public weeklyCounter;

    // ========== EVENTS ==========

    event TargetVaultUpdated(address oldVault, address newVault);

    // ========== ERRORS ==========

    error InvalidInterval(uint256 interval);
    error InvalidAddress(address addr);

    // ========== CONSTRUCTOR ==========

    /**
     * @notice Initializes the SchedulerRSC contract and subscribes to Cron events
     * @param _targetVault Address of the AutoYieldVault contract on Sepolia
     * @param _interval Cron interval (must be 100, 1000, 10000, or 60000)
     * @dev Subscription happens automatically in constructor using if (!vm) check
     *      Owner is set automatically by AbstractPausableReactive constructor
     */
    constructor(address _targetVault, uint256 _interval) payable {
        if (_targetVault == address(0))
            revert InvalidAddress(_targetVault);

        if (_interval != 100 && _interval != 1000 && _interval != 10000 && _interval != 60000)
            revert InvalidInterval(_interval);

        targetVault = _targetVault;
        interval = _interval;
        weeklyCounter = 0;

        // Subscribe to Cron events only when deployed to Reactive Network (not ReactVM)
        // Following the official pattern from CronDemo
        if (!vm) {
            uint256 topic;

            // For 60000 (weekly), subscribe to Cron10000
            if (interval == 60000) {
                topic = CRON10000_TOPIC;
            } else {
                topic = _getTopicForInterval(interval);
            }

            // Subscribe to system contract's Cron events
            // Use block.chainid and address(service) following official CronDemo pattern
            service.subscribe(
                block.chainid,      // Current chain (Reactive Network)
                address(service),   // System contract address
                topic,              // Topic0: specific Cron event
                REACTIVE_IGNORE,    // Ignore topic1
                REACTIVE_IGNORE,    // Ignore topic2
                REACTIVE_IGNORE     // Ignore topic3
            );
        }
    }

    // ========== REACTIVE LOGIC ==========

    /**
     * @notice Entry point for handling Cron events from Reactive Network
     * @dev Called by the Reactive Network when a subscribed Cron event is emitted
     * @param log The log record containing the Cron event data
     */
    function react(LogRecord calldata log) external vmOnly {
        // Verify the event is from the system contract
        if (log._contract != address(service)) return;

        // Handle based on current interval configuration
        if (interval == 60000) {
            // Weekly mode: count 6 occurrences of Cron10000
            _handleWeeklyMode();
        } else {
            // Direct modes (100, 1000, 10000): trigger immediately
            _handleDirectMode(log);
        }
    }

    /**
     * @notice Handles weekly mode (60000 interval)
     * @dev Counts Cron10000 events and triggers callback every 6th occurrence
     */
    function _handleWeeklyMode() private {
        // Increment counter
        weeklyCounter++;

        // If we've reached 6 iterations (~1 week), trigger rebalance
        if (weeklyCounter >= WEEKLY_ITERATIONS) {
            _triggerRebalance();
            weeklyCounter = 0; // Reset counter
        }
    }

    /**
     * @notice Handles direct modes (100, 1000, 10000 intervals)
     * @dev Triggers callback on every matching Cron event
     * @param log The log record from the Cron event
     */
    function _handleDirectMode(LogRecord calldata log) private {
        // Verify the event matches our subscribed interval
        uint256 expectedTopic = _getTopicForInterval(interval);
        if (log.topic_0 != expectedTopic) return;

        _triggerRebalance();
    }

    /**
     * @notice Emits a Callback event to trigger checkAndRebalance() on Sepolia
     * @dev The Reactive Network will execute this as a cross-chain transaction
     *      IMPORTANT: Reactive Network automatically replaces the first 160 bits
     *      of the call arguments with the RVM ID. Therefore, the first argument
     *      must be an address (which will be replaced with the actual RVM ID).
     */
    function _triggerRebalance() private {
        // Encode the function call: checkAndRebalance(address)
        // The address(0) will be automatically replaced by Reactive Network with the RVM ID
        bytes memory payload = abi.encodeWithSignature("checkAndRebalance(address)", address(0));

        // Emit Callback event for cross-chain execution
        emit Callback(SEPOLIA_CHAIN_ID, targetVault, CALLBACK_GAS_LIMIT, payload);
    }

    // ========== SUBSCRIPTION MANAGEMENT ==========

    /**
     * @notice Maps interval values to their corresponding Cron topic hashes
     * @param _interval The interval value (100, 1000, or 10000)
     * @return The topic0 hash for the corresponding Cron event
     */
    function _getTopicForInterval(uint256 _interval) private pure returns (uint256) {
        if (_interval == 100) return CRON100_TOPIC;
        if (_interval == 1000) return CRON1000_TOPIC;
        if (_interval == 10000) return CRON10000_TOPIC;
        revert InvalidInterval(_interval);
    }

    /**
     * @notice Returns the list of subscriptions for pause/resume functionality
     * @dev Required by AbstractPausableReactive
     * @return Array containing the single Cron event subscription
     */
    function getPausableSubscriptions() internal view override returns (Subscription[] memory) {
        Subscription[] memory subscriptions = new Subscription[](1);

        uint256 topic;
        // For 60000 (weekly), subscribe to Cron10000
        if (interval == 60000) {
            topic = CRON10000_TOPIC;
        } else {
            topic = _getTopicForInterval(interval);
        }

        subscriptions[0] = Subscription({
            chain_id: block.chainid,
            _contract: address(service),
            topic_0: topic,
            topic_1: REACTIVE_IGNORE,
            topic_2: REACTIVE_IGNORE,
            topic_3: REACTIVE_IGNORE
        });

        return subscriptions;
    }

    // ========== ADMINISTRATIVE FUNCTIONS ==========

    /**
     * @notice Allows owner to update the target vault address on Sepolia
     * @param _newVault The new AutoYieldVault address
     */
    function setTargetVault(address _newVault) external onlyOwner {
        if (_newVault == address(0)) revert InvalidAddress(_newVault);

        address oldVault = targetVault;
        targetVault = _newVault;

        emit TargetVaultUpdated(oldVault, _newVault);
    }

    /**
     * @notice Allows owner to manually reset the weekly counter
     * @dev Useful for testing or if counter gets out of sync
     */
    function resetWeeklyCounter() external onlyOwner {
        weeklyCounter = 0;
    }

    /**
     * @notice Public getter to check if scheduler is paused
     * @return True if the scheduler is currently paused
     */
    function isPaused() external view returns (bool) {
        return paused;
    }

    /**
     * @notice View function to check if contract is in weekly mode
     * @return True if interval is 60000 (weekly mode)
     */
    function isWeeklyMode() external view returns (bool) {
        return interval == 60000;
    }

    /**
     * @notice Allows owner to withdraw all contract balance
     * @dev Transfers entire contract balance to the owner
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @notice View function to check contract balance
     * @return Current contract balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
