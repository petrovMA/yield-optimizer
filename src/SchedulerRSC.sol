// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "reactive-lib/abstract-base/AbstractReactive.sol";

/**
 * @title SchedulerRSC
 * @notice Reactive Smart Contract that acts as a cron job to periodically trigger
 *         the AutoYieldVault contract on Sepolia to check and rebalance funds.
 * @dev Supports intervals: 100 (12 min), 1000 (2 hrs), 10000 (28 hrs), 60000 (~1 week)
 *      The 60000 interval counts 6 occurrences of Cron10000 to achieve ~1 week.
 */
contract SchedulerRSC is AbstractReactive {
    // ========== CONSTANTS ==========

    // Sepolia testnet chain ID
    uint256 private constant SEPOLIA_CHAIN_ID = 11155111;

    // System contract address for Reactive Network (emits Cron events)
    address private constant SYSTEM_CONTRACT = 0x0000000000000000000000000000000000fffFfF;

    // Topic0 hashes for Cron events (keccak256 of event signatures)
    uint256 private constant CRON100_TOPIC = 0xb49937fb8970e19fd46d48f7e3fb00d659deac0347f79cd7cb542f0fc1503c70;
    uint256 private constant CRON1000_TOPIC = 0xe20b31294d84c3661ddc8f423abb9c70310d0cf172aa2714ead78029b325e3f4;
    uint256 private constant CRON10000_TOPIC = 0xd214e1d84db704ed42d37f538ea9bf71e44ba28bc1cc088b2f5deca654677a56;

    // Gas limit for callback transaction on destination chain
    uint64 private constant CALLBACK_GAS_LIMIT = 1000000;

    // Weekly counter threshold (6 * Cron10000 = ~1 week)
    uint256 private constant WEEKLY_ITERATIONS = 6;

    // ========== STATE VARIABLES ==========

    // Address of the AutoYieldVault contract on Sepolia
    address public targetVault;

    // Cron interval: 100, 1000, 10000, or 60000
    uint256 public interval;

    // Contract owner (deployer) for administrative functions
    address public owner;

    // Counter for weekly mode (60000 interval)
    // Increments on each Cron10000 event, resets after reaching WEEKLY_ITERATIONS
    uint256 public weeklyCounter;

    // ========== EVENTS ==========

    event IntervalUpdated(uint256 oldInterval, uint256 newInterval);
    event TargetVaultUpdated(address oldVault, address newVault);

    // ========== ERRORS ==========

    error InvalidInterval(uint256 interval);
    error Unauthorized(address caller);
    error InvalidAddress(address addr);

    // ========== MODIFIERS ==========

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }

    // ========== CONSTRUCTOR ==========

    /**
     * @notice Initializes the SchedulerRSC contract
     * @param _targetVault Address of the AutoYieldVault contract on Sepolia
     * @param _interval Cron interval (must be 100, 1000, 10000, or 60000)
     */
    constructor(address _targetVault, uint256 _interval) {
        if (_targetVault == address(0)) revert InvalidAddress(_targetVault);
        if (_interval != 100 && _interval != 1000 && _interval != 10000 && _interval != 60000) {
            revert InvalidInterval(_interval);
        }

        owner = msg.sender;
        targetVault = _targetVault;
        interval = _interval;
        weeklyCounter = 0;

        // Subscribe to the appropriate Cron event based on interval
        _subscribeToInterval(_interval);
    }

    // ========== REACTIVE LOGIC ==========

    /**
     * @notice Entry point for handling Cron events from Reactive Network
     * @dev Called by the Reactive Network when a subscribed Cron event is emitted
     * @param log The log record containing the Cron event data
     */
    function react(LogRecord calldata log) external vmOnly {
        // Verify the event is from the system contract
        if (log._contract != SYSTEM_CONTRACT) return;

        // Handle based on current interval configuration
        if (interval == 60000) {
            // Weekly mode: count 6 occurrences of Cron10000
            _handleWeeklyMode(log);
        } else {
            // Direct modes (100, 1000, 10000): trigger immediately
            _handleDirectMode(log);
        }
    }

    /**
     * @notice Handles weekly mode (60000 interval)
     * @dev Counts Cron10000 events and triggers callback every 6th occurrence
     * @param log The log record from the Cron event
     */
    function _handleWeeklyMode(LogRecord calldata log) private {
        // Only process Cron10000 events in weekly mode
        if (log.topic_0 != CRON10000_TOPIC) return;

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
     */
    function _triggerRebalance() private {
        // Encode the function call: checkAndRebalance()
        bytes memory payload = abi.encodeWithSignature("checkAndRebalance()");

        // Emit Callback event for cross-chain execution
        emit Callback(SEPOLIA_CHAIN_ID, targetVault, CALLBACK_GAS_LIMIT, payload);
    }

    // ========== SUBSCRIPTION MANAGEMENT ==========

    /**
     * @notice Subscribes to the Cron event corresponding to the given interval
     * @param _interval The interval to subscribe to (100, 1000, 10000, or 60000)
     */
    function _subscribeToInterval(uint256 _interval) private rnOnly {
        uint256 topic;

        // For 60000 (weekly), subscribe to Cron10000
        if (_interval == 60000) {
            topic = CRON10000_TOPIC;
        } else {
            topic = _getTopicForInterval(_interval);
        }

        // Subscribe to system contract's Cron events
        service.subscribe(
            0, // chain_id: 0 = Reactive Network itself
            SYSTEM_CONTRACT, // System contract emits Cron events
            topic, // Topic0: specific Cron event
            REACTIVE_IGNORE, // Ignore topic1
            REACTIVE_IGNORE, // Ignore topic2
            REACTIVE_IGNORE // Ignore topic3
        );
    }

    /**
     * @notice Unsubscribes from the Cron event corresponding to the given interval
     * @param _interval The interval to unsubscribe from
     */
    function _unsubscribeFromInterval(uint256 _interval) private rnOnly {
        uint256 topic;

        // For 60000 (weekly), unsubscribe from Cron10000
        if (_interval == 60000) {
            topic = CRON10000_TOPIC;
        } else {
            topic = _getTopicForInterval(_interval);
        }

        service.unsubscribe(0, SYSTEM_CONTRACT, topic, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

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

    // ========== ADMINISTRATIVE FUNCTIONS ==========

    /**
     * @notice Allows owner to change the cron interval
     * @dev Unsubscribes from old interval and subscribes to new one
     *      Resets weekly counter when changing intervals
     * @param _newInterval The new interval (must be 100, 1000, 10000, or 60000)
     */
    function setInterval(uint256 _newInterval) external onlyOwner rnOnly {
        if (_newInterval != 100 && _newInterval != 1000 && _newInterval != 10000 && _newInterval != 60000) {
            revert InvalidInterval(_newInterval);
        }
        if (_newInterval == interval) return; // No change needed

        uint256 oldInterval = interval;

        // Unsubscribe from current interval
        _unsubscribeFromInterval(oldInterval);

        // Update interval
        interval = _newInterval;

        // Reset weekly counter
        weeklyCounter = 0;

        // Subscribe to new interval
        _subscribeToInterval(_newInterval);

        emit IntervalUpdated(oldInterval, _newInterval);
    }

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
     * @notice View function to check if contract is in weekly mode
     * @return True if interval is 60000 (weekly mode)
     */
    function isWeeklyMode() external view returns (bool) {
        return interval == 60000;
    }
}
