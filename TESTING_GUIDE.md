# Testing Guide: Cross-Chain Yield Optimizer

This guide provides step-by-step instructions for testing the basic rebalancing scenario with APY changes across different lending pools.

## Prerequisites

Before starting, ensure you have:
- Foundry installed (`forge`, `cast`)
- Access to `.env` file with deployed contract addresses
- Sepolia and Reactive Network RPC endpoints configured

## Required Environment Variables

Create or update your `.env` file with deployed contract addresses:

```bash
# Network RPCs
SEPOLIA_RPC=https://rpc.sepolia.org
REACTIVE_RPC=https://kopli-rpc.rkt.ink

# Private Keys
PRIVATE_KEY_SEPOLIA=your_sepolia_private_key
PRIVATE_KEY_REACTIVE=your_reactive_private_key

# Deployed Contract Addresses (Sepolia)
MOCK_USDT=0x...                   # MockToken (USDT) address
AAVE_POOL=0x...                   # MockAavePool (Aave) address
SPARK_POOL=0x...                  # MockAavePool (Spark) address - same contract, different deployment
COMPOUND_COMET=0x...              # MockCompoundComet address
AUTO_YIELD_VAULT=0x...            # AutoYieldVault address

# Deployed Contract Addresses (Reactive Network)
SCHEDULER_RSC=0x...               # SchedulerRSC address

# Testing Parameters
TEST_WALLET=0x...                 # Your test wallet address
```

---

## Test Scenario: APY Change & Rebalancing

### Phase 1: Initial State Verification

#### 1.1 Check Mock Token Details

```bash
# Get token name
cast call $MOCK_USDT "name()(string)" --rpc-url $SEPOLIA_RPC

# Get token symbol
cast call $MOCK_USDT "symbol()(string)" --rpc-url $SEPOLIA_RPC

# Check your balance
cast call $MOCK_USDT "balanceOf(address)(uint256)" $TEST_WALLET --rpc-url $SEPOLIA_RPC
```

#### 1.2 Check AutoYieldVault Configuration

```bash
# Get asset address (should match MOCK_TOKEN)
cast call $AUTO_YIELD_VAULT "asset()(address)" --rpc-url $SEPOLIA_RPC

# Get active pool (where funds are currently deposited)
cast call $AUTO_YIELD_VAULT "activePool()(address)" --rpc-url $SEPOLIA_RPC

# Get rebalance threshold (in Ray format, 1e27)
cast call $AUTO_YIELD_VAULT "rebalanceThresholdRay()(uint256)" --rpc-url $SEPOLIA_RPC

# Get lending pools (indexed: 0, 1, 2)
cast call $AUTO_YIELD_VAULT "lendingPools(uint256)(address)" 0 --rpc-url $SEPOLIA_RPC
cast call $AUTO_YIELD_VAULT "lendingPools(uint256)(address)" 1 --rpc-url $SEPOLIA_RPC
cast call $AUTO_YIELD_VAULT "lendingPools(uint256)(address)" 2 --rpc-url $SEPOLIA_RPC
```

**Expected Results:**
- `asset` = `$MOCK_USDT`
- `activePool` = first pool from the list (AAVE_POOL)
- `rebalanceThresholdRay` = `5000000000000000000000000` (0.5%)

#### 1.3 Check Current APY Rates

**For Aave Pool:**
```bash
# Get reserve data for USDT in Aave pool
# Returns: (ReserveData struct) - field #2 is currentLiquidityRate
cast call $AAVE_POOL "getReserveData(address)((uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16))" \
  $MOCK_USDT --rpc-url $SEPOLIA_RPC
```

**For Spark Pool (same interface as Aave):**
```bash
# SPARK_POOL is also MockAavePool contract, different deployment
cast call $SPARK_POOL "getReserveData(address)((uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16))" \
  $MOCK_USDT --rpc-url $SEPOLIA_RPC
```

**For Compound Comet:**
```bash
# Get current supply rate (per second in Wad format, 1e18)
cast call $COMPOUND_COMET "getSupplyRate(uint256)(uint64)" 0 --rpc-url $SEPOLIA_RPC
```

**APY Format Reference:**
- **Aave (Ray format)**: 1e27 = 100%
  - 5% APY = `50000000000000000000000000` (5 * 1e25)
- **Compound (Wad per second)**:
  - 5% APY ≈ `1585489599188229325` per second

#### 1.4 Check SchedulerRSC Configuration (Reactive Network)

```bash
# Get target vault address (should match AUTO_YIELD_VAULT)
cast call $SCHEDULER_RSC "targetVault()(address)" --rpc-url $REACTIVE_RPC

# Get interval configuration
cast call $SCHEDULER_RSC "interval()(uint256)" --rpc-url $REACTIVE_RPC

# Check if in weekly mode
cast call $SCHEDULER_RSC "isWeeklyMode()(bool)" --rpc-url $REACTIVE_RPC

# If weekly mode, check counter
cast call $SCHEDULER_RSC "weeklyCounter()(uint256)" --rpc-url $REACTIVE_RPC

# Check RSC contract balance (for callback execution)
cast balance $SCHEDULER_RSC --rpc-url $REACTIVE_RPC
```

**Expected Results:**
- `targetVault` = `$AUTO_YIELD_VAULT`
- `interval` = one of: 100, 1000, 10000, 60000
- RSC should have sufficient balance (>0.01 ETH recommended)

---

### Phase 2: Prepare Test Funds

#### 2.1 Mint Test Tokens

```bash
# Mint 10,000 USDT tokens to your wallet
cast send $MOCK_USDT "mint(address,uint256)" \
  $TEST_WALLET \
  10000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC

# Verify minting
cast call $MOCK_USDT "balanceOf(address)(uint256)" $TEST_WALLET --rpc-url $SEPOLIA_RPC
```

**Expected:** Balance = `10000000000000000000000` (10,000 tokens with 18 decimals)

#### 2.2 Approve AutoYieldVault

```bash
# Approve vault to spend 5,000 tokens
cast send $MOCK_USDT "approve(address,uint256)" \
  $AUTO_YIELD_VAULT \
  5000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC

# Verify allowance
cast call $MOCK_USDT "allowance(address,address)(uint256)" \
  $TEST_WALLET \
  $AUTO_YIELD_VAULT \
  --rpc-url $SEPOLIA_RPC
```

#### 2.3 Deposit Funds into Vault

```bash
# Deposit 5,000 tokens
cast send $AUTO_YIELD_VAULT "deposit(uint256)" \
  5000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

**Verify deposit via events:**
```bash
# Get recent Deposit events from vault
cast logs --from-block latest --to-block latest \
  --address $AUTO_YIELD_VAULT \
  "Deposit(address indexed,uint256)" \
  --rpc-url $SEPOLIA_RPC
```

#### 2.4 Check Pool Balances

```bash
# Check vault's balance in the active pool (AAVE_POOL)
cast call $AAVE_POOL "userBalances(address,address)(uint256)" \
  $MOCK_USDT \
  $AUTO_YIELD_VAULT \
  --rpc-url $SEPOLIA_RPC
```

**Expected:** Should show `5000000000000000000000` (5,000 tokens)

---

### Phase 3: Create Rebalancing Opportunity

#### 3.1 Set Initial APY Rates

Let's establish a baseline where both pools have similar rates:

**Set Aave Pool to 3% APY:**
```bash
# 3% = 0.03 * 1e27 = 30000000000000000000000000
cast send $AAVE_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  30000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

**Set Spark Pool to 3.2% APY:**
```bash
# SPARK_POOL uses the same MockAavePool interface as AAVE_POOL
# 3.2% = 0.032 * 1e27 = 32000000000000000000000000
cast send $SPARK_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  32000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

**Set Compound Pool to ~3% APY:**
```bash
# Calculate per-second rate for 3% APY
# Formula: rate_per_second = (APY / SECONDS_PER_YEAR) * 1e18
# 3% = 0.03 / 31536000 * 1e18 = 951293759 (truncated to fit uint64)
# NOTE: Compound uses per-second rates stored as uint64, NOT Ray (1e27)
cast send $COMPOUND_COMET "setSupplyRate(uint256)" \
  951293759 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

#### 3.2 Verify Rate Difference

```bash
# Check Aave Pool rate
cast call $AAVE_POOL "getReserveData(address)" $MOCK_USDT --rpc-url $SEPOLIA_RPC

# Check Spark Pool rate
cast call $SPARK_POOL "getReserveData(address)" $MOCK_USDT --rpc-url $SEPOLIA_RPC

# Check Compound Pool rate
cast call $COMPOUND_COMET "getSupplyRate(uint256)(uint64)" 0 --rpc-url $SEPOLIA_RPC
```

**Current State:**
- AAVE_POOL: 3% APY
- SPARK_POOL: 3.2% APY
- COMPOUND_COMET: ~3% APY

**Note:** All rates are similar (differences below 0.5% threshold).
No rebalancing should occur yet.

#### 3.3 Increase Spark Pool APY Above Threshold

Now let's create a significant rate difference:

**Set Spark Pool to 5% APY:**
```bash
# 5% = 0.05 * 1e27 = 50000000000000000000000000
cast send $SPARK_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  50000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

**Current State:**
- AAVE_POOL: 3% APY
- SPARK_POOL: 5% APY (highest)
- COMPOUND_COMET: ~3% APY
- Best pool difference: 2% (exceeds 0.5% threshold) ✅

---

### Phase 4: Trigger Rebalancing

You have two options to trigger rebalancing:

#### Option A: Wait for Automatic Cron Trigger

```bash
# Monitor SchedulerRSC on Reactive Network
# Check latest blocks for Callback events

cast logs --from-block -100 --to-block latest \
  --address $SCHEDULER_RSC \
  "Callback(uint256,address,uint64,bytes)" \
  --rpc-url $REACTIVE_RPC
```

**Timing based on interval:**
- `100`: ~12 minutes
- `1000`: ~2 hours
- `10000`: ~28 hours
- `60000`: ~1 week (6 occurrences of Cron10000)

**Block Explorer Monitoring:**
- Reactive Network: https://kopli.reactscan.net/address/YOUR_SCHEDULER_ADDRESS
- Watch for Callback events being emitted

#### Option B: Manual Trigger (Faster Testing)

```bash
# Call manualRebalance() as owner
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

This immediately executes the rebalancing logic without waiting for the cron trigger.

---

### Phase 5: Verify Rebalancing Execution

#### 5.1 Check RebalanceExecuted Event

```bash
# Get recent RebalanceExecuted events
cast logs --from-block -50 --to-block latest \
  --address $AUTO_YIELD_VAULT \
  "RebalanceExecuted(address indexed,address indexed,uint256,uint256,uint256)" \
  --rpc-url $SEPOLIA_RPC
```

**Expected Event Data:**
- `oldPool`: `$AAVE_POOL` address (initial active pool)
- `newPool`: `$SPARK_POOL` address (best APY pool)
- `amount`: `5000000000000000000000` (5,000 tokens)
- `oldRate`: `30000000000000000000000000` (3%)
- `newRate`: `50000000000000000000000000` (5%)

#### 5.2 Verify Active Pool Changed

```bash
# Check current active pool
cast call $AUTO_YIELD_VAULT "activePool()(address)" --rpc-url $SEPOLIA_RPC
```

**Expected:** Should now be `$SPARK_POOL` address

#### 5.3 Verify Fund Movement

**Check Aave Pool balance (should be 0):**
```bash
cast call $AAVE_POOL "userBalances(address,address)(uint256)" \
  $MOCK_USDT \
  $AUTO_YIELD_VAULT \
  --rpc-url $SEPOLIA_RPC
```

**Check Spark Pool balance (should be 5,000):**
```bash
cast call $SPARK_POOL "userBalances(address,address)(uint256)" \
  $MOCK_USDT \
  $AUTO_YIELD_VAULT \
  --rpc-url $SEPOLIA_RPC
```

**Expected Results:**
- AAVE_POOL: `0`
- SPARK_POOL: `5000000000000000000000`

#### 5.4 Block Explorer Verification

**Sepolia Testnet:**
1. Navigate to: https://sepolia.etherscan.io/address/YOUR_VAULT_ADDRESS
2. Click "Events" tab
3. Look for recent transactions showing:
   - `RebalanceExecuted` event
   - `Withdraw` from old pool
   - `Supply` to new pool

**Reactive Network (Kopli):**
1. Navigate to: https://kopli.reactscan.net/address/YOUR_SCHEDULER_ADDRESS
2. Check for `Callback` event emissions

---

### Phase 6: Test Rebalancing Threshold

#### 6.1 Test: Below Threshold (No Rebalance)

```bash
# Current: SPARK_POOL has 5%, AAVE_POOL has 3%
# Set AAVE_POOL to 4.8% (difference = 0.2%, below 0.5% threshold)

cast send $AAVE_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  48000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC

# Trigger rebalance
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC

# Check for RebalanceSkipped event
cast logs --from-block -10 --to-block latest \
  --address $AUTO_YIELD_VAULT \
  "RebalanceSkipped(uint256,uint256,string)" \
  --rpc-url $SEPOLIA_RPC
```

**Expected:** `RebalanceSkipped` event with reason: "Difference below threshold"

#### 6.2 Test: Same Pool (Already Optimal)

```bash
# Set SPARK_POOL (current active) to highest rate
# AAVE_POOL = 3%, SPARK_POOL = 6%

cast send $SPARK_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT \
  60000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC

# Trigger rebalance
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

**Expected:** `RebalanceSkipped` event with reason: "Already in best pool"

---

### Phase 7: User Withdrawal Test

#### 7.1 Withdraw Funds

```bash
# Withdraw 1,000 tokens
cast send $AUTO_YIELD_VAULT "withdraw(uint256)" \
  1000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC

# Verify your token balance increased
cast call $MOCK_USDT "balanceOf(address)(uint256)" $TEST_WALLET --rpc-url $SEPOLIA_RPC
```

**Expected:** Balance increased by `1000000000000000000000`

#### 7.2 Verify Pool Balance Updated

```bash
# Check vault's balance in active pool (SPARK_POOL if it's current active)
cast call $SPARK_POOL "userBalances(address,address)(uint256)" \
  $MOCK_USDT \
  $AUTO_YIELD_VAULT \
  --rpc-url $SEPOLIA_RPC
```

**Expected:** Reduced to `4000000000000000000000` (4,000 tokens remaining)

---

## Advanced Testing Scenarios

### Scenario A: Multiple Rebalances Across All 3 Pools

Test sequential rebalancing: SPARK → AAVE → COMPOUND → SPARK

1. Set AAVE_POOL to 8% (highest)
2. Wait for/trigger rebalance → funds move from SPARK to AAVE_POOL
3. Set COMPOUND to ~10% APY (new highest)
4. Wait for/trigger rebalance → funds move from AAVE to COMPOUND
5. Set SPARK_POOL to 12% (new highest)
6. Wait for/trigger rebalance → funds move from COMPOUND to SPARK
7. Verify each transition via events

**Example Commands:**
```bash
# Step 1: Set AAVE_POOL to 8% (highest)
cast send $AAVE_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT 80000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA --rpc-url $SEPOLIA_RPC

# Step 2: Trigger rebalance (SPARK → AAVE)
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA --rpc-url $SEPOLIA_RPC

# Verify active pool changed to AAVE
cast call $AUTO_YIELD_VAULT "activePool()(address)" --rpc-url $SEPOLIA_RPC

# Step 3: Set COMPOUND to 10% APY (per-second rate)
# 10% APY = 3170979198 per second (truncated to fit uint64)
cast send $COMPOUND_COMET "setSupplyRate(uint256)" \
  3170979198 \
  --private-key $PRIVATE_KEY_SEPOLIA --rpc-url $SEPOLIA_RPC

# Step 4: Trigger rebalance (AAVE → COMPOUND)
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA --rpc-url $SEPOLIA_RPC

# Verify active pool changed to COMPOUND
cast call $AUTO_YIELD_VAULT "activePool()(address)" --rpc-url $SEPOLIA_RPC

# Step 5: Set SPARK_POOL to 12%
cast send $SPARK_POOL "setLiquidityRate(address,uint256)" \
  $MOCK_USDT 120000000000000000000000000 \
  --private-key $PRIVATE_KEY_SEPOLIA --rpc-url $SEPOLIA_RPC

# Step 6: Trigger rebalance (COMPOUND → SPARK)
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA --rpc-url $SEPOLIA_RPC

# Step 7: Verify final state
cast call $AUTO_YIELD_VAULT "activePool()(address)" --rpc-url $SEPOLIA_RPC

# Check all pool balances
cast call $AAVE_POOL "userBalances(address,address)(uint256)" \
  $MOCK_USDT $AUTO_YIELD_VAULT --rpc-url $SEPOLIA_RPC
cast call $SPARK_POOL "userBalances(address,address)(uint256)" \
  $MOCK_USDT $AUTO_YIELD_VAULT --rpc-url $SEPOLIA_RPC
cast call $COMPOUND_COMET "userBalances(address)(uint256)" \
  $AUTO_YIELD_VAULT --rpc-url $SEPOLIA_RPC
```

**Expected Results:**
- AAVE_POOL balance: 0
- SPARK_POOL balance: 5000 tokens (or remaining after withdrawals)
- COMPOUND_COMET balance: 0
- Active pool: SPARK_POOL

### Scenario B: Weekly Cron Testing (60000 interval)

If your SchedulerRSC uses `interval = 60000`:

```bash
# Monitor weekly counter
watch -n 60 'cast call $SCHEDULER_RSC "weeklyCounter()(uint256)" --rpc-url $REACTIVE_RPC'

# Wait for 6 Cron10000 events (~7 days)
# Or manually reset counter for testing:
cast send $SCHEDULER_RSC "resetWeeklyCounter()" \
  --private-key $PRIVATE_KEY_REACTIVE \
  --rpc-url $REACTIVE_RPC
```

### Scenario C: SchedulerRSC Balance Monitoring

```bash
# Check balance before callbacks
cast balance $SCHEDULER_RSC --rpc-url $REACTIVE_RPC

# Monitor balance depletion over time
# Each callback costs ~0.003-0.01 ETH depending on gas prices

# Top up if needed:
cast send $SCHEDULER_RSC \
  --value 0.1ether \
  --private-key $PRIVATE_KEY_REACTIVE \
  --rpc-url $REACTIVE_RPC
```

---

## Troubleshooting

### Issue: Rebalancing Not Triggered

**Possible Causes:**
1. SchedulerRSC has insufficient balance
2. Callback proxy not authorized on AutoYieldVault
3. Rate difference below threshold

**Debug:**
```bash
# Check SchedulerRSC balance
cast balance $SCHEDULER_RSC --rpc-url $REACTIVE_RPC

# Manually trigger to test logic
cast send $AUTO_YIELD_VAULT "manualRebalance()" \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

### Issue: "Unauthorized" Error on Callback

```bash
# Verify callback sender is authorized
# AutoYieldVault uses AbstractCallback's authorizedSenderOnly modifier
# Ensure SchedulerRSC's RVM ID is calling the function

# For testing, use manualRebalance() which has onlyOwner modifier instead
```

### Issue: Gas Estimation Failed

```bash
# Some transactions need gas limit specification:
cast send $AUTO_YIELD_VAULT "deposit(uint256)" \
  1000000000000000000000 \
  --gas-limit 500000 \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --rpc-url $SEPOLIA_RPC
```

---

## Test Results Checklist

- [ ] MockToken deployed and mintable
- [ ] AutoYieldVault configured with correct pools
- [ ] SchedulerRSC subscribed to Cron events
- [ ] Initial deposit successful
- [ ] APY rates can be changed via admin functions
- [ ] Rebalancing triggered (automatic or manual)
- [ ] Funds moved from low APY → high APY pool
- [ ] RebalanceExecuted event emitted with correct data
- [ ] Active pool updated in vault state
- [ ] Withdrawal works after rebalancing
- [ ] Threshold logic prevents unnecessary rebalances
- [ ] Block explorers show all transactions and events

---

## Useful Commands Reference

### Quick APY Calculations

**Ray Format (Aave):**
```
1% APY   = 10000000000000000000000000   (1e25)
3% APY   = 30000000000000000000000000   (3e25)
5% APY   = 50000000000000000000000000   (5e25)
10% APY  = 100000000000000000000000000  (1e26)
```

**Wad Per Second (Compound):**
```
1% APY  = 317097919     per second  (0.01 / 31536000 * 1e18, truncated)
3% APY  = 951293759     per second  (0.03 / 31536000 * 1e18, truncated)
5% APY  = 1585489599    per second  (0.05 / 31536000 * 1e18, truncated)
10% APY = 3170979198    per second  (0.10 / 31536000 * 1e18, truncated)
```

### Event Signature Hashes

```bash
# For filtering logs
Deposit:          0x90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15
Withdraw:         0xf341246adaac6f497bc2a656f546ab9e182111d630394f0c57c710a59a2cb567
RebalanceExecuted: 0x...  # Run cast keccak "RebalanceExecuted(address,address,uint256,uint256,uint256)"
RebalanceSkipped:  0x...  # Run cast keccak "RebalanceSkipped(uint256,uint256,string)"
Callback:         0x...  # Run cast keccak "Callback(uint256,address,uint64,bytes)"
```

### Network Information

**Sepolia:**
- Chain ID: 11155111
- Explorer: https://sepolia.etherscan.io
- Faucet: https://sepoliafaucet.com

**Reactive Network (Kopli):**
- Chain ID: 5318008
- RPC: https://kopli-rpc.rkt.ink
- Explorer: https://kopli.reactscan.net

---

## Next Steps

After completing basic testing:

1. **Load Testing**: Test with larger amounts and multiple users
2. **Gas Optimization**: Monitor gas costs of rebalancing
3. **Edge Cases**: Test with 0 balance, single pool, identical rates
4. **Long-term Monitoring**: Run for full cron cycle (1 week for interval 60000)
5. **Multi-asset Support**: Extend to different tokens if implemented

## Support

For issues or questions:
- GitHub: https://github.com/Reactive-Network/reactive-lib
- Reactive Network Docs: https://dev.reactive.network
- Block Explorers: Check transaction details for error messages
