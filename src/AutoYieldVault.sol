// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "reactive-lib/abstract-base/AbstractCallback.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

// --- INTERFACES ---

/**
 * @title IAavePool
 * @notice Interface for Aave V3 and SparkLend (identical interfaces)
 * @dev Used to interact with our Mock contracts
 */
interface IAavePool {
    struct ReserveConfigurationMap {
        uint256 data;
    }

    struct ReserveData {
        ReserveConfigurationMap configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate; // APY in RAY (1e27)
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 __deprecatedStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveData(address asset) external view returns (ReserveData memory);
}

/**
 * @title ICompoundComet
 * @notice Interface for Compound V3 (Comet)
 * @dev Different interface from Aave - uses per-second rates in Wad (1e18)
 */
interface ICompoundComet {
    function supply(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
    function getSupplyRate(uint256 utilization) external view returns (uint64);
    function getUtilization() external view returns (uint256);
    function baseToken() external view returns (address);
    function userBalances(address user) external view returns (uint256);
}

/**
 * @title AutoYieldVault
 * @notice Automated Cross-Chain Yield Optimizer
 * @dev Monitors lending pools (Aave, Spark) and moves funds to the highest APY pool
 *      triggered by Reactive Network callbacks.
 */
contract AutoYieldVault is AbstractCallback, Ownable {
    using SafeERC20 for IERC20;

    // ========== STATE VARIABLES ==========

    IERC20 public immutable asset;          // The underlying asset (e.g., MockUSDT)
    address[] public lendingPools;          // List of supported pools (Aave, Spark, etc.)
    address public activePool;              // The pool where funds are currently deposited

    // Pool type tracking: false = Aave-style, true = Compound-style
    mapping(address => bool) public isCompoundPool;

    // Threshold to prevent micro-rebalancing (Gas savings)
    // 100 = 1.00% difference required to move funds (assuming Ray math adjustments)
    // Stored in Ray for direct comparison (1% = 0.01 * 1e27)
    uint256 public rebalanceThresholdRay;

    // Constants
    uint256 constant RAY = 1e27;
    uint256 constant SECONDS_PER_YEAR = 31536000;

    // ========== EVENTS ==========

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event PoolAdded(address indexed pool);
    event RebalanceExecuted(
        address indexed oldPool,
        address indexed newPool,
        uint256 amount,
        uint256 oldRate,
        uint256 newRate
    );
    event RebalanceSkipped(uint256 currentRate, uint256 bestRate, string reason);

    // ========== ERRORS ==========

    error Unauthorized(address caller);
    error InvalidAddress();
    error NoPoolsConfigured();
    error TransferFailed();

    // ========== CONSTRUCTOR ==========

    /**
     * @param _callbackProxy Address of the Reactive Network Callback Proxy
     * @param _asset Address of the underlying token (USDT)
     * @param _initialPools Array of initial lending pool addresses (MockAave, MockSpark)
     */
    constructor(
        address _callbackProxy,
        address _asset,
        address[] memory _initialPools
    ) AbstractCallback(_callbackProxy) Ownable(msg.sender) payable {
        require(_asset != address(0), "Invalid asset");
        asset = IERC20(_asset);

        // Add initial pools
        for(uint i = 0; i < _initialPools.length; i++) {
            lendingPools.push(_initialPools[i]);
            emit PoolAdded(_initialPools[i]);
        }

        // Set default active pool to the first one if available
        if (_initialPools.length > 0) {
            activePool = _initialPools[0];
        }

        // Default threshold: ~0.5% difference needed (5 * 10^24)
        rebalanceThresholdRay = 5 * 10**24;
    }

    // ========== REACTIVE CALLBACK ==========

    /**
     * @notice Triggered by SchedulerRSC via Reactive Network
     * @dev Checks APY rates and executes rebalance if profitable
     * @param _rvmId The RVM ID (ReactVM address) - validated by AbstractCallback
     */
    function checkAndRebalance(address _rvmId) external authorizedSenderOnly {
        _executeRebalanceLogic();
    }

    /**
     * @notice Manual trigger for demonstration purposes
     */
    function manualRebalance() external onlyOwner {
        _executeRebalanceLogic();
    }

    // ========== CORE LOGIC ==========

    /**
     * @notice Get APY rate from pool in Ray format (1e27)
     * @dev Handles both Aave-style and Compound-style pools
     */
    function _getPoolRateInRay(address poolAddr) internal view returns (uint256 rate, bool success) {
        if (isCompoundPool[poolAddr]) {
            // Compound-style pool: rate is per-second in Wad (1e18)
            try ICompoundComet(poolAddr).getSupplyRate(0) returns (uint64 ratePerSecond) {
                // Convert per-second Wad rate to annual Ray rate
                // APY_Ray = ratePerSecond * SECONDS_PER_YEAR * 1e9
                rate = uint256(ratePerSecond) * SECONDS_PER_YEAR * 1e9;
                success = true;
            } catch {
                success = false;
            }
        } else {
            // Aave-style pool: rate is already in Ray
            try IAavePool(poolAddr).getReserveData(address(asset)) returns (IAavePool.ReserveData memory data) {
                rate = data.currentLiquidityRate;
                success = true;
            } catch {
                success = false;
            }
        }
    }

    function _executeRebalanceLogic() internal {
        if (lendingPools.length < 2) return; // Nothing to compare

        uint256 highestRate = 0;
        address bestPool = activePool;
        uint256 currentPoolRate = 0;

        // 1. Scan all pools for the best rate
        for (uint i = 0; i < lendingPools.length; i++) {
            address poolAddr = lendingPools[i];

            (uint256 rate, bool success) = _getPoolRateInRay(poolAddr);

            if (!success) continue;

            if (poolAddr == activePool) {
                currentPoolRate = rate;
            }

            if (rate > highestRate) {
                highestRate = rate;
                bestPool = poolAddr;
            }
        }

        // 2. Check conditions
        if (bestPool == activePool) {
            emit RebalanceSkipped(currentPoolRate, highestRate, "Already in best pool");
            return;
        }

        if (highestRate <= currentPoolRate + rebalanceThresholdRay) {
            emit RebalanceSkipped(currentPoolRate, highestRate, "Difference below threshold");
            return;
        }

        // 3. Execute Rebalance
        _moveFunds(activePool, bestPool, currentPoolRate, highestRate);
    }

    function _moveFunds(address _from, address _to, uint256 _oldRate, uint256 _newRate) internal {
        uint256 withdrawnAmount;

        // A. Withdraw everything from current pool
        if (isCompoundPool[_from]) {
            // Compound: get balance first, then withdraw
            uint256 balance = ICompoundComet(_from).userBalances(address(this));
            if (balance > 0) {
                ICompoundComet(_from).withdraw(address(asset), balance);
            }
            withdrawnAmount = balance;
        } else {
            // Aave: withdraw max
            withdrawnAmount = IAavePool(_from).withdraw(address(asset), type(uint256).max, address(this));
        }

        if (withdrawnAmount == 0) return;

        // B. Approve new pool
        asset.forceApprove(_to, withdrawnAmount);

        // C. Supply to new pool
        if (isCompoundPool[_to]) {
            ICompoundComet(_to).supply(address(asset), withdrawnAmount);
        } else {
            IAavePool(_to).supply(address(asset), withdrawnAmount, address(this), 0);
        }

        // D. Update state
        activePool = _to;

        emit RebalanceExecuted(_from, _to, withdrawnAmount, _oldRate, _newRate);
    }

    // ========== USER FUNCTIONS ==========

    /**
     * @notice Users deposit funds into the Vault
     * @param amount Amount of USDT to deposit
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(activePool != address(0), "No active pool");

        // 1. Transfer from User to Vault
        asset.safeTransferFrom(msg.sender, address(this), amount);

        // 2. Supply to the currently active pool
        asset.forceApprove(activePool, amount);

        if (isCompoundPool[activePool]) {
            ICompoundComet(activePool).supply(address(asset), amount);
        } else {
            IAavePool(activePool).supply(address(asset), amount, address(this), 0);
        }

        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Users withdraw funds from the Vault
     * @dev Simple implementation: withdraws proportionally from the active pool
     * @param amount Amount of underlying asset to withdraw
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(activePool != address(0), "No active pool");

        // 1. Withdraw from active pool to Vault
        if (isCompoundPool[activePool]) {
            ICompoundComet(activePool).withdraw(address(asset), amount);
        } else {
            IAavePool(activePool).withdraw(address(asset), amount, address(this));
        }

        // 2. Transfer to User
        asset.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    // ========== ADMIN CONFIG ==========

    function setRebalanceThreshold(uint256 _newThresholdRay) external onlyOwner {
        rebalanceThresholdRay = _newThresholdRay;
    }

    /**
     * @notice Add a new Aave-style lending pool
     * @param _pool Pool address
     */
    function addLendingPool(address _pool) external onlyOwner {
        lendingPools.push(_pool);
        emit PoolAdded(_pool);
    }

    /**
     * @notice Add a new Compound-style lending pool
     * @param _pool Pool address
     */
    function addCompoundPool(address _pool) external onlyOwner {
        lendingPools.push(_pool);
        isCompoundPool[_pool] = true;
        emit PoolAdded(_pool);
    }

    /**
     * @notice Set pool type (for existing pools)
     * @param _pool Pool address
     * @param _isCompound true if Compound-style, false if Aave-style
     */
    function setPoolType(address _pool, bool _isCompound) external onlyOwner {
        isCompoundPool[_pool] = _isCompound;
    }

    /**
     * @notice Allow contract to receive ETH (needed for gas/deployment costs sometimes)
     */
    receive() external payable override {}
}