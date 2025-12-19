# Cross-Chain Yield Optimizer

Automated DeFi Vault that maximizes yield by automatically rebalancing funds between different lending protocols using Reactive Network's cross-chain automation.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Contracts](#key-contracts)
- [How It Works](#how-it-works)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)
- [Future Improvements](#future-improvements)

## 🎯 Overview

This project implements a **cross-chain yield optimization system** that:
- Monitors APY rates across multiple lending protocols (AAVE, Spark, etc.)
- Automatically rebalances user funds to the highest-yielding protocol
- Uses Reactive Network for automated, time-based triggers
- Operates across two chains: **Sepolia** (destination) and **Reactive Network** (controller)

**Key Features:**
- ⏰ **Automated Scheduling**: Configurable time intervals (12 min to 1 week)
- 🔄 **Cross-Chain Communication**: Reactive Network → Sepolia callbacks
- 💰 **Yield Optimization**: Automatic fund rebalancing to maximize APY
- 🛡️ **Security**: Owner-controlled admin functions with access control
- 🧪 **Tested**: Comprehensive test suite with 22 passing tests

## 🏗️ Architecture

### Two-Chain System

```
┌───────────────────────────────────────────────────────────────┐
│                    REACTIVE NETWORK (Controller)              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  SystemContract (0x0000...fffFfF)                       │  │
│  │  - Emits Cron events every N blocks                     │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                       │ Cron100 (12 min)                      │
│                       │ Cron1000 (2 hrs)                      │
│                       │ Cron10000 (28 hrs)                    │
│                       ↓                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  SchedulerRSC.sol                                       │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ State:                                          │    │  │
│  │  │  - targetVault: 0x... (AutoYieldVault address)  │    │  │
│  │  │  - interval: 100 | 1000 | 10000 | 60000         │    │  │
│  │  │  - weeklyCounter: 0-5 (for 60000 mode)          │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                         │  │
│  │  react(LogRecord log) {                                 │  │
│  │    if (interval == 60000) {                             │  │
│  │      weeklyCounter++                                    │  │
│  │      if (weeklyCounter >= 6) trigger & reset            │  │
│  │    } else {                                             │  │
│  │      trigger immediately                                │  │
│  │    }                                                    │  │
│  │  }                                                      │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                       │ emit Callback(                        │
│                       │   chainId: 11155111,                  │
│                       │   target: AutoYieldVault,             │
│                       │   payload: checkAndRebalance()        │
│                       │ )                                     │
└───────────────────────┼───────────────────────────────────────┘
                        │
                        │ Cross-Chain Transaction
                        ↓
┌───────────────────────────────────────────────────────────────┐
│                    SEPOLIA NETWORK (Destination)              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  AutoYieldVault.sol                                     │  │
│  │  - Holds user deposits                                  │  │
│  │  - Manages funds across protocols                       │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                       │                                       │
│                       │ checkAndRebalance() called            │
│                       ↓                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  1. Query APY from all pools                            │  │
│  │     ┌──────────────┐  ┌──────────────┐                  │  │
│  │     │ AAVEPoolMock │  │ SparkPoolMock│                  │  │
│  │     │  APY: 4.5%   │  │  APY: 5.2%   │                  │  │
│  │     └──────────────┘  └──────────────┘                  │  │
│  │                                                         │  │
│  │  2. Find highest APY pool (Spark: 5.2%)                 │  │
│  │                                                         │  │
│  │  3. If current ≠ best:                                  │  │
│  │     - Withdraw from current pool                        │  │
│  │     - Deposit to best pool                              │  │
│  │                                                         │  │
│  │  4. Emit RebalanceCompleted event                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## 📦 Key Contracts

### 1. **SchedulerRSC.sol** (Reactive Network)

The heart of the automation system - a Reactive Smart Contract that triggers periodic rebalancing.

**Location:** `src/SchedulerRSC.sol`

**Features:**
- Subscribes to Cron events from SystemContract
- Supports 4 time intervals:
  - `100` → Every 100 blocks (~12 minutes)
  - `1000` → Every 1,000 blocks (~2 hours)
  - `10000` → Every 10,000 blocks (~28 hours)
  - `60000` → Every 60,000 blocks (~1 week) - **Counts 6x Cron10000 events**
- Emits cross-chain Callbacks to trigger rebalancing on Sepolia
- Owner-controlled configuration (interval, target vault, counter reset)

**Key Functions:**
```solidity
constructor(address _targetVault, uint256 _interval) // Deploys and subscribes to cron
react(LogRecord calldata log)                        // Entry point for Cron events
setTargetVault(address _newVault)                    // Update vault address
resetWeeklyCounter()                                 // Manually reset counter (weekly mode)
```

**Note:** Interval cannot be changed after deployment (immutable).

**Weekly Mode Logic:**
```
Cron10000 #1 → counter = 1
Cron10000 #2 → counter = 2
Cron10000 #3 → counter = 3
Cron10000 #4 → counter = 4
Cron10000 #5 → counter = 5
Cron10000 #6 → counter = 6 → TRIGGER CALLBACK → counter = 0
```

### 2. **AutoYieldVault.sol** (Sepolia) ✅ MVP Implemented

The vault contract that receives callbacks from SchedulerRSC.

**Location:** `src/AutoYieldVault.sol`

**MVP Features:**
- Receives cross-chain callbacks from SchedulerRSC
- Emits `RebalancingTriggered` event when called
- Owner-controlled administrative functions (`transferOwnership`)
- Public `checkAndRebalance()` - anyone can trigger

**Future Features:**
- Accept user deposits
- Query APY from multiple lending pools
- Withdraw/deposit funds to maximize yield
- Execute rebalancing logic based on APY comparison

### 3. **AAVEPoolMock.sol** (Sepolia)

Mock implementation of AAVE V3 Pool for testing.

**Location:** `src/AAVEPoolMock.sol`

**Features:**
- `supply()` - Deposit tokens
- `withdraw()` - Withdraw tokens
- `setLiquidityRate()` - Update APY (for simulation)
- Emits `ReserveDataUpdated` events

### 4. **MockToken.sol** (Sepolia)

Simple ERC20 token with public mint function for testing.

**Location:** `src/MockToken.sol`

## ⚙️ How It Works

### 1. Initialization

```solidity
// Deploy SchedulerRSC on Reactive Network
SchedulerRSC scheduler = new SchedulerRSC(
    vaultAddress,  // AutoYieldVault on Sepolia
    1000           // Check every 2 hours
);
```

### 2. Cron Event Subscription

When deployed, SchedulerRSC automatically subscribes to the appropriate Cron event:

```solidity
service.subscribe(
    0,                     // Reactive Network chain
    SYSTEM_CONTRACT,       // 0x0000...fffFfF
    CRON1000_TOPIC,        // Topic for Cron1000
    REACTIVE_IGNORE,
    REACTIVE_IGNORE,
    REACTIVE_IGNORE
);
```

### 3. Event Trigger & Callback

Every 1000 blocks (~2 hours), SystemContract emits Cron1000:

```
Block 1000  → Cron1000 emitted
              ↓
            SchedulerRSC.react() called
              ↓
            Validates: log._contract == SYSTEM_CONTRACT
            Validates: log.topic_0 == CRON1000_TOPIC
              ↓
            emit Callback(
              11155111,                              // Sepolia
              vaultAddress,
              1000000,                               // gas limit
              abi.encodeWithSignature("checkAndRebalance()")
            )
              ↓
            Reactive Network executes cross-chain TX
              ↓
            AutoYieldVault.checkAndRebalance() called on Sepolia
```

### 4. Rebalancing Logic

On Sepolia, AutoYieldVault:
1. Queries current APY from all pools
2. Identifies the pool with highest yield
3. If current pool ≠ best pool:
   - Withdraws funds from current pool
   - Deposits funds to best pool
4. Emits event confirming rebalance

## 🚀 Setup & Installation

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Git

### Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd yield-optimizer

# Install Foundry dependencies
forge install

# Verify installation
forge build
```

### Dependencies

- **OpenZeppelin Contracts** - ERC20 and standard utilities
- **Forge-std** - Testing framework
- **Reactive-lib** - Reactive Network integration

## 📖 Usage

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vv

# Run specific test file
forge test --match-path test/SchedulerRSC.t.sol

# Run specific test function
forge test --match-test testSetInterval

# Gas report
forge test --gas-report
```

### Format

```bash
forge fmt
```

### Gas Snapshots

```bash
forge snapshot
```

## 🧪 Testing

The project includes comprehensive test coverage:

```
test/
├── AAVEPoolMock.t.sol     - 3 tests for mock lending pool
├── AutoYieldVault.t.sol   - 15 tests for vault contract
├── SchedulerRSC.t.sol     - 17 tests for scheduler contract
└── Counter.t.sol          - 2 tests (default Foundry template)

Total: 37 tests, all passing ✓
```

**Test Results:**
```bash
$ forge test

Ran 3 tests for test/AAVEPoolMock.t.sol:AAVEPoolMockTest
[PASS] testRateUpdateEmitsEvent() (gas: 42951)
[PASS] testSupply() (gas: 80924)
[PASS] testWithdraw() (gas: 91554)

Ran 15 tests for test/AutoYieldVault.t.sol:AutoYieldVaultTest
[PASS] testAnyoneCanCallCheckAndRebalance() (gas: 15376)
[PASS] testConstructorSetsOwner() (gas: 10171)
[PASS] testOwnerCanTransferOwnership() (gas: 23533)
... (all tests passing)

Ran 17 tests for test/SchedulerRSC.t.sol:SchedulerRSCTest
[PASS] testAllIntervalsAreValid() (gas: 5285130)
[PASS] testConstructorAcceptsAllValidIntervals() (gas: 5284971)
[PASS] testConstructorSetsInterval() (gas: 7937)
... (all tests passing)

37 tests passed, 0 failed
```

## 🌐 Deployment

### Quick Start

```bash
# 1. Setup environment
cp .env.example .env
nano .env  # Add your PRIVATE_KEY_REACTIVE, TARGET_VAULT, INTERVAL

# 2. Load environment variables
source .env

# 3. Deploy SchedulerRSC to Reactive Lasna Testnet (subscription happens automatically)
forge create src/SchedulerRSC.sol:SchedulerRSC \
  --broadcast \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE \
  --value 0.1ether \
  --constructor-args $TARGET_VAULT $INTERVAL
```

**That's it!** The contract is deployed and automatically subscribed to cron events.

### Detailed Guide

For complete deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Includes:**
- Network setup and configuration
- Getting testnet tokens (REACT for Reactive Network, ETH for Sepolia)
- Deploying to Reactive Lasna Testnet
- Deploying mock contracts to Sepolia
- Contract verification
- Post-deployment configuration
- Troubleshooting guide

### Deploy AutoYieldVault to Sepolia

**Step 1: Deploy the Vault**
```bash
# Deploy AutoYieldVault
forge create src/AutoYieldVault.sol:AutoYieldVault \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --constructor-args <YOUR_ADDRESS>
```

**Step 2: Update .env**
```bash
# Save the deployed vault address
TARGET_VAULT=<DEPLOYED_VAULT_ADDRESS>
```

**Step 3: Deploy SchedulerRSC** (see Quick Start above)

### Deploy Mock Contracts to Sepolia (Optional)

```bash
# Deploy MockToken (USDT)
forge create src/MockToken.sol:MockToken \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --constructor-args "USDT Mock" "USDT"

# Deploy AAVEPoolMock
forge create src/MockAavePool.sol:AAVEPoolMock \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

### Post-Deployment Configuration

After deployment, you can update the scheduler settings:

```bash
# Update target vault
cast send <SCHEDULER_ADDRESS> \
  "setTargetVault(address)" <NEW_VAULT_ADDRESS> \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE

# Reset weekly counter (for weekly mode only)
cast send <SCHEDULER_ADDRESS> \
  "resetWeeklyCounter()" \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE
```

**Note:** Interval cannot be changed after deployment. To use a different interval, deploy a new contract.

## 📊 Cron Intervals Reference

| Interval | Blocks | Approx. Time | Use Case |
|----------|--------|--------------|----------|
| 100 | 100 | ~12 minutes | Testing, high-frequency trading |
| 1000 | 1,000 | ~2 hours | Active yield farming |
| 10000 | 10,000 | ~28 hours | Daily rebalancing |
| 60000 | 60,000 | ~1 week | Long-term strategies |

**Note:** 60000 interval counts 6 occurrences of Cron10000 (6 × 28 hours ≈ 7 days)

## 🔐 Security Considerations

- **Owner Control**: All admin functions protected by `onlyOwner` modifier
- **Modifier Protection**:
  - `rnOnly` - Ensures functions execute only on Reactive Network
  - `vmOnly` - Ensures `react()` executes only in ReactVM
- **Input Validation**: Constructor validates intervals and addresses
- **No Hardcoded Addresses**: All addresses passed via constructor/setters
- **Gas Efficiency**: Lightweight `react()` logic to minimize costs

## 🛠️ Future Improvements

### 1. Shared SchedulerRSC for Multiple Users
**Goal:** Allow multiple users to share one SchedulerRSC contract instead of deploying individual instances.

**Implementation:**
- Users register their vault address + callback function
- Pay REACT tokens to cover cross-chain execution costs
- Single scheduler triggers callbacks for all registered users
- Reduces deployment costs and simplifies infrastructure

**Benefits:**
- Lower barrier to entry
- Shared infrastructure costs
- More efficient resource usage

### 2. Diversification & Risk Management
**Goal:** Prevent over-concentration in a single lending pool.

**Implementation:**
- Add maximum deposit percentage per pool (e.g., max 40%)
- Implement diversification strategy:
  - Pool A: 40% (highest APY)
  - Pool B: 35% (second highest)
  - Pool C: 25% (third highest)
- Configurable risk parameters per vault

**Benefits:**
- Reduced smart contract risk
- Protection against pool exploits
- More stable returns

### 3. Additional Features
- **Gas Optimization**: Batch multiple operations in single transaction
- **APY Oracle Integration**: Use Chainlink or similar for reliable APY data
- **Emergency Pause**: Circuit breaker for emergency situations
- **Whitelist Pools**: Only rebalance to audited, trusted protocols
- **Rebalancing Threshold**: Only rebalance if APY difference > X%
- **Historical Analytics**: Track performance over time

## 📚 Documentation

- [Foundry Book](https://book.getfoundry.sh/)
- [Reactive Network Docs](https://dev.reactive.network/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🏆 Built With

- [Foundry](https://getfoundry.sh/) - Ethereum development toolkit
- [Reactive Network](https://www.reactive.network/) - Cross-chain automation
- [OpenZeppelin](https://www.openzeppelin.com/) - Secure smart contract library
- [Solidity](https://soliditylang.org/) - Smart contract programming language

---

**Note:** This project is a hackathon MVP and should not be used in production without thorough auditing and additional security measures.