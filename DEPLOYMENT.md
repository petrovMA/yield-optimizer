# Deployment Guide

Complete deployment instructions for Cross-Chain Yield Optimizer.

## Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Setup environment
cp .env.example .env
nano .env  # Add your private keys
source .env
```

Required `.env` variables:
```bash
PRIVATE_KEY_REACTIVE=your_reactive_private_key
PRIVATE_KEY_SEPOLIA=your_sepolia_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Network Information

**Reactive Lasna Testnet:**
- RPC: `https://lasna-rpc.rnk.dev/`
- Chain ID: 5318007
- Explorer: https://lasna.reactscan.net

**Sepolia Testnet:**
- RPC: `https://ethereum-sepolia-rpc.publicnode.com`
- Chain ID: 11155111
- Explorer: https://sepolia.etherscan.io
- Callback Proxy: `0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA`

## APY Format Reference

Before deploying, understand the two different APY formats used by the mock contracts:

### Aave/Spark - Ray Format (1e27)
- **Format**: Annual percentage rate in Ray (1e27 = 100%)
- **Example**: 5% APY = 0.05 * 1e27 = `50000000000000000000000000`
- **Calculation**: `APY_percentage * 1e25`

**Common Values:**
```
1% APY   = 10000000000000000000000000   (1e25)
3% APY   = 30000000000000000000000000   (3e25)
5% APY   = 50000000000000000000000000   (5e25)
10% APY  = 100000000000000000000000000  (1e26)
```

### Compound V3 - Per-Second Rate in Wad (1e18)
- **Format**: Per-second interest rate in Wad (1e18)
- **Formula**: `rate_per_second = APY / SECONDS_PER_YEAR * 1e18`
- **SECONDS_PER_YEAR**: 31536000

**Common Values:**
```
1% APY   = 317097919     per second
3% APY   = 951293759     per second
5% APY   = 1585489599    per second
10% APY  = 3170979198    per second
```

**Conversion to Ray (done by AutoYieldVault):**
```solidity
// Compound per-second rate (Wad) → Annual rate (Ray)
APY_Ray = rate_per_second * SECONDS_PER_YEAR * 1e9
```

**Example:**
```
5% APY in Compound:
  Input:  1585489599 (per-second Wad)
  Output: 1585489599 * 31536000 * 1e9 = 50000000000000000000000000 (Ray)
  Result: 5e25 = 5% ✓
```

## Deployment Steps

### 1. Deploy MockToken (USDT) on Sepolia

```bash
forge create src/mocks/MockToken.sol:MockToken \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --constructor-args "USDT Mock" "USDT" \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Save address as `MOCK_USDT`.

### 2. Deploy MockAavePool (Aave) on Sepolia

```bash
forge create src/mocks/MockAavePool.sol:MockAavePool \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Save address as `AAVE_POOL`.

**Set liquidity rate to 5%:**
```bash
# 5% APY = 50000000000000000000000000 (Ray format: 0.05 * 1e27)
cast send $AAVE_POOL \
  "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  50000000000000000000000000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

### 3. Deploy MockAavePool (Spark) on Sepolia

```bash
forge create src/mocks/MockAavePool.sol:MockAavePool \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Save address as `SPARK_POOL`.

**Set liquidity rate to 6%:**
```bash
# 6% APY = 60000000000000000000000000 (Ray format: 0.06 * 1e27)
cast send $SPARK_POOL \
  "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  60000000000000000000000000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

### 4. Deploy MockCompoundComet on Sepolia

```bash
forge create src/mocks/MockCompoundComet.sol:MockCompoundComet \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --constructor-args $MOCK_USDT \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Save address as `COMPOUND_COMET`.

**Set supply rate to ~5% APY:**
```bash
# Compound V3 uses per-second interest rates (stored as uint64)
# Formula: rate_per_second = (APY / SECONDS_PER_YEAR) * 1e18
#          But result must fit in uint64, so we truncate decimals
#
# For 5% APY:
#   rate_per_second = 0.05 / 31536000 * 1e18
#   rate_per_second = 1585489599 (truncated to fit uint64)
#
# IMPORTANT: This is DIFFERENT from Aave/Spark which use Ray format (1e27)
# Compound: uint64 per-second rate (fits ~9 digits for realistic APY)
# Aave:     Ray (1e27) annual rate
#
# The AutoYieldVault converts Compound's per-second rate to annual Ray:
#   APY_Ray = rate_per_second * SECONDS_PER_YEAR * 1e9
#
# Example verification:
#   1585489599 * 31536000 * 1e9 ≈ 50000000000000000000000000 (5e25 = 5%)
#
# Common values:
#   1% APY  = 317097919
#   3% APY  = 951293759
#   5% APY  = 1585489599
#   10% APY = 3170979198

cast send $COMPOUND_COMET \
  "setSupplyRate(uint256)" \
  3170979198 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

### 5. Deploy AutoYieldVault on Sepolia

```bash
# Prepare constructor args
CALLBACK_PROXY=0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA

# Deploy with 3 pools: Aave, Spark, Compound
forge create src/AutoYieldVault.sol:AutoYieldVault \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --value 0.005ether \
  --constructor-args $CALLBACK_PROXY $MOCK_USDT "[$AAVE_POOL,$SPARK_POOL,$COMPOUND_COMET]" \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Save address as `AUTO_YIELD_VAULT`.

**Verify deployment:**
```bash
cast call $AUTO_YIELD_VAULT "asset()(address)" --rpc-url sepolia
cast call $AUTO_YIELD_VAULT "activePool()(address)" --rpc-url sepolia
cast call $AUTO_YIELD_VAULT "owner()(address)" --rpc-url sepolia
```

### 6. Deploy SchedulerRSC on Reactive Lasna

Choose interval:
- `100` = 12 minutes
- `1000` = 2 hours
- `10000` = 28 hours
- `60000` = ~1 week

```bash
# Deploy with interval 1000 (2 hours)
forge create src/SchedulerRSC.sol:SchedulerRSC \
  --broadcast \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE \
  --value 0.015ether \
  --constructor-args $AUTO_YIELD_VAULT 100
```

Save address as `SCHEDULER_RSC`.

**Verify deployment:**
```bash
cast call $SCHEDULER_RSC "targetVault()(address)" --rpc-url reactive_lasna
cast call $SCHEDULER_RSC "interval()(uint256)" --rpc-url reactive_lasna
cast balance $SCHEDULER_RSC --rpc-url reactive_lasna --ether
```

## Post-Deployment Testing

### Test Manual Deposit

```bash
# 1. Mint USDT to your address
cast send $MOCK_USDT \
  "mint(address,uint256)" \
  $TEST_WALLET \
  1000000000000000000000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA

# 2. Approve vault
cast send $MOCK_USDT \
  "approve(address,uint256)" \
  $AUTO_YIELD_VAULT \
  1000000000000000000000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA

# 3. Deposit to vault
cast send $AUTO_YIELD_VAULT \
  "deposit(uint256)" \
  1000000000000000000000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

### Test Manual Rebalance

```bash
cast send $AUTO_YIELD_VAULT \
  "manualRebalance()" \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

### Monitor Events

**Watch for rebalancing on Sepolia:**
```bash
cast logs \
  --address $AUTO_YIELD_VAULT \
  --event "RebalanceExecuted(address,address,uint256,uint256,uint256)" \
  --rpc-url sepolia \
  --follow
```

**Watch for callbacks from Reactive:**
```bash
cast logs \
  --address $SCHEDULER_RSC \
  --event "Callback(uint256,address,uint64,bytes)" \
  --rpc-url reactive_lasna \
  --follow
```

## Manage SchedulerRSC Balance

**Check balance and debt:**
```bash
cast balance $SCHEDULER_RSC --rpc-url reactive_lasna --ether

cast call 0x0000000000000000000000000000000000fffFfF \
  "debt(address)(uint256)" \
  $SCHEDULER_RSC \
  --rpc-url reactive_lasna
```

**Fund contract:**
```bash
cast send $SCHEDULER_RSC \
  --value 0.1ether \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE
```

**Withdraw funds (owner only):**
```bash
cast send $SCHEDULER_RSC \
  "withdraw()" \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE
```

## Update Configuration

**Change target vault:**
```bash
cast send $SCHEDULER_RSC \
  "setTargetVault(address)" \
  <NEW_VAULT_ADDRESS> \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE
```

**Add new lending pool to vault:**
```bash
cast send $AUTO_YIELD_VAULT \
  "addLendingPool(address)" \
  <NEW_POOL_ADDRESS> \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

**Set rebalance threshold:**
```bash
# 1% threshold = 10000000000000000000000000 (Ray: 0.01 * 1e27)
cast send $AUTO_YIELD_VAULT \
  "setRebalanceThreshold(uint256)" \
  10000000000000000000000000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

## Quick Reference

**Contract Addresses (fill after deployment):**
```bash
export MOCK_USDT=0x...
export AAVE_POOL=0x...
export SPARK_POOL=0x...
export COMPOUND_COMET=0x...
export AUTO_YIELD_VAULT=0x...
export SCHEDULER_RSC=0x...
```

**Check vault status:**
```bash
echo "Asset: $(cast call $AUTO_YIELD_VAULT 'asset()(address)' --rpc-url sepolia)"
echo "Active Pool: $(cast call $AUTO_YIELD_VAULT 'activePool()(address)' --rpc-url sepolia)"
echo "Owner: $(cast call $AUTO_YIELD_VAULT 'owner()(address)' --rpc-url sepolia)"
```

**Check scheduler status:**
```bash
echo "Target Vault: $(cast call $SCHEDULER_RSC 'targetVault()(address)' --rpc-url reactive_lasna)"
echo "Interval: $(cast call $SCHEDULER_RSC 'interval()(uint256)' --rpc-url reactive_lasna)"
echo "Balance: $(cast balance $SCHEDULER_RSC --rpc-url reactive_lasna --ether) REACT"
```

## Troubleshooting

**Verification stuck?**
- Press Ctrl+C, contract is already deployed
- Verify manually: `forge verify-contract <ADDRESS> <CONTRACT> --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY`

**Callbacks not working?**
1. Check SchedulerRSC balance: `cast balance $SCHEDULER_RSC --rpc-url reactive_lasna --ether`
2. Check debt: `cast call 0x0000000000000000000000000000000000fffFfF "debt(address)(uint256)" $SCHEDULER_RSC --rpc-url reactive_lasna`
3. Fund if needed: `cast send $SCHEDULER_RSC --value 0.1ether --rpc-url reactive_lasna --private-key $PRIVATE_KEY_REACTIVE`

**Rebalance not executing?**
- Check APY difference exceeds threshold (default 0.5%)
- Verify pools are returning valid rates: `cast call $AAVE_POOL "getReserveData(address)" $MOCK_USDT --rpc-url sepolia`

## Resources

- [Reactive Network Docs](https://dev.reactive.network/)
- [Lasna Explorer](https://lasna.reactscan.net)
- [Sepolia Explorer](https://sepolia.etherscan.io)
- [Foundry Book](https://book.getfoundry.sh/)