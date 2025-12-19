# Deployment Guide

Complete guide for deploying the Cross-Chain Yield Optimizer to Reactive Network.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Network Information](#network-information)
- [Setup](#setup)
- [Deploy SchedulerRSC to Reactive Lasna Testnet](#deploy-schedulerrsc-to-reactive-lasna-testnet)
- [Deploy Mock Contracts to Sepolia](#deploy-mock-contracts-to-sepolia)
- [Verify Contracts](#verify-contracts)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

1. **Foundry installed**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **REACT tokens on Lasna Testnet**
   - Get testnet REACT from the faucet (if available)
   - Or bridge from Sepolia to Reactive Lasna

3. **ETH on Sepolia** (for deploying vault and mock contracts)
   - Get Sepolia ETH from: https://sepoliafaucet.com/

4. **Private Key**
   - Use a test wallet, NOT your mainnet wallet
   - Export private key from MetaMask (without 0x prefix)

## 🌐 Network Information

### Reactive Lasna Testnet
- **Network Name:** Reactive Lasna
- **RPC URL:** `https://lasna-rpc.rnk.dev/`
- **Chain ID:** 5318007
- **Currency:** REACT
- **Block Explorer:** https://lasna.reactscan.net
- **System Contract:** `0x0000000000000000000000000000000000fffFfF`

### Sepolia Testnet
- **RPC URL:** `https://ethereum-sepolia-rpc.publicnode.com`
- **Chain ID:** 11155111
- **Currency:** ETH
- **Block Explorer:** https://sepolia.etherscan.io

## ⚙️ Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd yield-optimizer
forge install
```

### 2. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your values
nano .env
```

**.env file:**
```bash
# IMPORTANT: Use separate wallets for each network for security
# Private key for Reactive Network (without 0x prefix)
PRIVATE_KEY_REACTIVE=your_reactive_network_private_key

# Private key for Sepolia (without 0x prefix)
PRIVATE_KEY_SEPOLIA=your_sepolia_private_key

# Target vault on Sepolia (deploy vault first, or use placeholder)
TARGET_VAULT=0x1234567890123456789012345678901234567890

# Cron interval: 100 | 1000 | 10000 | 60000
INTERVAL=1000

# Sepolia RPC (optional, for vault deployment)
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Etherscan API (optional, for verification)
ETHERSCAN_API_KEY=your_api_key
```

### 3. Load Environment Variables

```bash
source .env
```

## 🚀 Deploy SchedulerRSC to Reactive Lasna Testnet

### Deployment

This is the official deployment method from Reactive Network demos:

```bash
forge create src/SchedulerRSC.sol:SchedulerRSC \
  --broadcast \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE \
  --value 0.05ether \
  --constructor-args $TARGET_VAULT $INTERVAL
```

**Example with specific values:**
```bash
# Weekly rebalancing (60000 blocks)
forge create src/SchedulerRSC.sol:SchedulerRSC \
  --broadcast \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE \
  --value 0.1ether \
  --constructor-args 0x729042614618F24bE3ed3e0b824A0be0B4da1bcE 60000
```

forge verify-contract $TARGET_VAULT src/AutoYieldVault.sol:AutoYieldVault --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY

**Explanation:**
- `--broadcast` - Actually sends the transaction to the blockchain
- `--rpc-url reactive_lasna` - Uses the RPC endpoint from foundry.toml
- `--value 0.1ether` - Sends 0.1 REACT for callback gas payments
- `--constructor-args` - Takes two arguments: vault address and interval
- Subscription happens automatically in the constructor

### Verify Deployment

Check contract status:

```bash
# Check contract balance (should have REACT for callbacks)
cast balance <SCHEDULER_ADDRESS> --rpc-url reactive_lasna --ether

# Check target vault
cast call <SCHEDULER_ADDRESS> "targetVault()(address)" --rpc-url reactive_lasna

# Check interval
cast call <SCHEDULER_ADDRESS> "interval()(uint256)" --rpc-url reactive_lasna
```

Expected output:
- Balance: `0.1` REACT or more
- Target Vault: Your vault address
- Interval: 100, 1000, 10000, or 60000

### Save Deployment Info

After successful deployment, `forge create` will output:

```
Deployer: 0x537b27d03a24157c5Fe2B0915b00df73C80C5643
Deployed to: 0xABCDEF1234567890ABCDEF1234567890ABCDEF12
Transaction hash: 0x...
```

**Save the contract address!** You'll need it for future interactions.

### Verify on Block Explorer

Visit: `https://lasna.reactscan.net/address/<YOUR_CONTRACT_ADDRESS>`

You should see:
- Contract creation transaction
- Subscription transaction
- Contract bytecode
- Owner address
- Contract balance (1+ REACT)

## 📦 Deploy AutoYieldVault to Sepolia

**IMPORTANT:** Deploy AutoYieldVault BEFORE deploying SchedulerRSC, as you need the vault address.

### Step 1: Deploy AutoYieldVault

```bash
# Deploy AutoYieldVault (owner automatically set to deployer)
forge create src/AutoYieldVault.sol:AutoYieldVault \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --value 0.01ether \
  --verify \
  --constructor-args 0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA
```

**Note:** Constructor no longer requires owner parameter - it automatically uses msg.sender (deployer)

### Step 2: Save Vault Address

After deployment, save the vault address:

```bash
# Copy the "Deployed to:" address from output
export TARGET_VAULT=0x...  # Replace with actual address

# Update .env file
echo "TARGET_VAULT=$TARGET_VAULT" >> .env
```

### Step 3: Verify Deployment

```bash
# Check owner
cast call $TARGET_VAULT "owner()(address)" --rpc-url sepolia

# Should return your address
```

### Step 4: Deploy SchedulerRSC

Now deploy SchedulerRSC using the vault address (see section above).

## 📦 Deploy Mock Contracts to Sepolia (Optional)

For testing with mock lending pools:

### 1. Deploy MockToken (USDT)

```bash
forge create src/MockToken.sol:MockToken \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --constructor-args "USDT Mock" "USDT" \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Save the deployed address!

### 2. Deploy AAVEPoolMock

```bash
forge create src/AAVEPoolMock.sol:AAVEPoolMock \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### 3. Set Initial APY

```bash
# Set liquidity rate to 4.5% (450 basis points)
cast send <AAVE_POOL_ADDRESS> \
  "setLiquidityRate(address,uint256)" \
  <USDT_TOKEN_ADDRESS> \
  450 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA
```

## ✅ Verify Contracts

### Verify AutoYieldVault on Sepolia Etherscan

**Method 1: Verify during deployment (Foundry v1.5.0+)**

```bash
# Deploy and verify in one command (requires Foundry v1.5.0+)
forge create src/AutoYieldVault.sol:AutoYieldVault \
  --broadcast \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --value 0.01ether \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Method 2: Verify after deployment (Recommended - Always works)**

```bash
# For AutoYieldVault (no constructor args)
forge verify-contract \
  0x8F58f929d2d12Bf88e795c8F523558d24B59D7A3 \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Or use environment variable
forge verify-contract \
  $TARGET_VAULT \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Verify MockToken (with constructor args):**

```bash
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/MockToken.sol:MockToken \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string)" "USDT Mock" "USDT")
```

**Verify AAVEPoolMock (no constructor args):**

```bash
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/AAVEPoolMock.sol:AAVEPoolMock \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### Verify on Lasna Reactscan

Unfortunately, Foundry's `--verify` flag doesn't work with Reactive Network yet. Manual verification:

1. Go to: https://lasna.reactscan.net/address/<CONTRACT_ADDRESS>
2. Click "Contract" tab
3. Click "Verify & Publish"
4. Upload the source code

### Complete Verification Guide

**Prerequisites:**
1. **Foundry v1.5.0 or higher** (for Etherscan API V2 support)
2. **Etherscan API key** set in `.env` file
3. **solc_version** configured in `foundry.toml`

**Step-by-step verification process:**

#### 1. Update Foundry (if needed)

```bash
# Check current version
forge --version

# Update if version is below 1.5.0
foundryup

# Verify new version
forge --version  # Should show 1.5.0 or higher
```

#### 2. Clean cache (if upgrading from old Foundry)

```bash
# Clean old cache to avoid compatibility issues
forge clean

# Rebuild project with new cache
forge build
```

#### 3. Ensure foundry.toml has solc_version

Your `foundry.toml` should include:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"  # Add this line
```

#### 4. Load environment variables

```bash
# Always load .env before verification commands
source .env

# Verify variables are loaded
echo $ETHERSCAN_API_KEY  # Should output your API key
echo $TARGET_VAULT       # Should output vault address
```

#### 5. Run verification

```bash
# Load environment
source .env

# Verify contract
forge verify-contract \
  $TARGET_VAULT \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Or with specific address
forge verify-contract \
  0x8F58f929d2d12Bf88e795c8F523558d24B59D7A3 \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Success looks like:**
```
Start verifying contract `0x8F58...` deployed on sepolia
Submitting verification for [src/AutoYieldVault.sol:AutoYieldVault]
Response: `OK`
GUID: `...`
URL: https://sepolia.etherscan.io/address/0x8f58...
Contract verification status:
Response: `OK`
Details: `Pass - Verified`
Contract successfully verified
```

### Troubleshooting Verification

**Error: "deprecated V1 endpoint" or "You are using a deprecated V1 endpoint"**

This means Foundry is outdated. Solution:
```bash
# Update Foundry to v1.5.0+
foundryup

# Clean cache and rebuild
forge clean
forge build

# Try verification again
source .env
forge verify-contract $TARGET_VAULT \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Error: "missing field `preprocessed`" or cache errors**

This happens after upgrading Foundry. Solution:
```bash
# Clean corrupted cache
forge clean

# Rebuild with new cache
forge build

# Verify again
source .env
forge verify-contract $TARGET_VAULT \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Error: "compiler version must be provided"**

Add `solc_version` to `foundry.toml`:
```bash
# Check which solidity version your contract uses
grep "pragma solidity" src/AutoYieldVault.sol
# Output: pragma solidity ^0.8.20;

# Add to foundry.toml under [profile.default]
echo 'solc_version = "0.8.28"' >> foundry.toml

# Rebuild
forge build

# Verify
source .env
forge verify-contract $TARGET_VAULT \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**Error: "Source code does not match"**

Ensure exact compiler version match:
```bash
# Use --watch flag to see detailed status
source .env
forge verify-contract \
  $TARGET_VAULT \
  src/AutoYieldVault.sol:AutoYieldVault \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --watch
```

**Error: "Already verified"**

The contract is already verified! Check on Etherscan:
```bash
# Open in browser
echo "https://sepolia.etherscan.io/address/$TARGET_VAULT"
```

**Error: "Invalid API key"**

Check your `.env` file:
```bash
# Verify API key is set correctly
cat .env | grep ETHERSCAN_API_KEY

# Make sure you loaded the environment
source .env
echo $ETHERSCAN_API_KEY  # Should show your key

# Get API key from: https://etherscan.io/myapikey
```

**Verification timeout or hanging**

The verification might succeed even if it times out. Check Etherscan:
```bash
# Visit the contract page
echo "https://sepolia.etherscan.io/address/$TARGET_VAULT#code"

# If "Contract Source Code Verified" appears, it worked!
```

## ⚙️ Post-Deployment Configuration

### 1. Check Contract Status

```bash
# Check interval
cast call <SCHEDULER_ADDRESS> "interval()(uint256)" \
  --rpc-url reactive_lasna

# Check target vault
cast call <SCHEDULER_ADDRESS> "targetVault()(address)" \
  --rpc-url reactive_lasna

# Check owner
cast call <SCHEDULER_ADDRESS> "owner()(address)" \
  --rpc-url reactive_lasna
```

### 2. Update Configuration (if needed)

**Change target vault:**
```bash
cast send <SCHEDULER_ADDRESS> \
  "setTargetVault(address)" <NEW_VAULT_ADDRESS> \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE
```

**Reset weekly counter (for weekly mode only):**
```bash
cast send <SCHEDULER_ADDRESS> \
  "resetWeeklyCounter()" \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE
```

**Note:** Interval cannot be changed after deployment. To use a different interval, deploy a new contract.

### 3. Fund the Contract

The SchedulerRSC contract needs REACT tokens to pay for cross-chain callback gas:

```bash
cast send <SCHEDULER_ADDRESS> \
  --value 1ether \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY
```

This sends 1 REACT to the contract for gas fees.

## 🐛 Troubleshooting

### Error: "Deployer has no REACT tokens"

**Solution:** Fund your Reactive Network wallet with testnet REACT tokens.

```bash
# Check balance
cast balance <YOUR_REACTIVE_ADDRESS> --rpc-url reactive_lasna
```

### Error: "Failed to decode private key"

**Solution:** Make sure you're using the correct private key variable:

```bash
# For Reactive Network deployments
export PRIVATE_KEY_REACTIVE=0x...

# For Sepolia deployments
export PRIVATE_KEY_SEPOLIA=0x...

# Or load from .env
source .env
```

### Error: "TARGET_VAULT must be set"

**Solution:** Set the TARGET_VAULT environment variable:

```bash
export TARGET_VAULT=0x1234567890123456789012345678901234567890
```

Or edit your `.env` file.

### Error: "INTERVAL must be 100, 1000, 10000, or 60000"

**Solution:** Use one of the valid intervals:

```bash
export INTERVAL=1000
```

### Callbacks not triggering?

Check contract state:

```bash
# Check contract has funds for callbacks
cast balance <SCHEDULER_ADDRESS> --rpc-url reactive_lasna --ether

# Check interval
cast call <SCHEDULER_ADDRESS> "interval()(uint256)" --rpc-url reactive_lasna

# Check target vault address
cast call <SCHEDULER_ADDRESS> "targetVault()(address)" --rpc-url reactive_lasna
```

**Common issues:**
- Contract balance too low (needs REACT for callback gas)
- Wrong target vault address
- Target vault contract not deployed on Sepolia

### Deployment Stuck?

Check transaction on block explorer:

```bash
# Get latest transaction
cast tx --rpc-url reactive_lasna <TX_HASH>
```

## 📊 Monitoring

### Watch for Callback Events on Reactive Network

Monitor when SchedulerRSC sends callbacks:

```bash
# Watch for Callback events from SchedulerRSC
cast logs \
  --address <SCHEDULER_ADDRESS> \
  --event "Callback(uint256,address,uint64,bytes)" \
  --rpc-url reactive_lasna
```

### Monitor AutoYieldVault Events on Sepolia

**Watch for RebalancingTriggered events:**

```bash
# Real-time monitoring
cast logs \
  --address <VAULT_ADDRESS> \
  --event "RebalancingTriggered(address,uint256,uint256)" \
  --rpc-url sepolia \
  --follow

# Or check from specific block
cast logs \
  --address <VAULT_ADDRESS> \
  --event "RebalancingTriggered(address,uint256,uint256)" \
  --from-block <START_BLOCK> \
  --rpc-url sepolia
```

**Decode event details:**

```bash
# Get latest RebalancingTriggered event
cast logs \
  --address <VAULT_ADDRESS> \
  --event "RebalancingTriggered(address,uint256,uint256)" \
  --rpc-url sepolia \
  | jq '.[0]'
```

**Expected output:**
```json
{
  "address": "0x...",
  "topics": [
    "0x...",  // Event signature
    "0x...",  // caller (indexed)
    "0x..."   // timestamp (indexed)
  ],
  "data": "0x...",  // blockNumber
  "blockNumber": "0x...",
  "transactionHash": "0x..."
}
```

### Verify Cross-Chain Integration

**Check that callbacks are flowing correctly:**

1. **On Reactive Network:** SchedulerRSC emits Callback
2. **Cross-chain execution:** Reactive Network processes callback
3. **On Sepolia:** AutoYieldVault emits RebalancingTriggered

**Quick verification script:**

```bash
SCHEDULER=<SCHEDULER_ADDRESS>
VAULT=<VAULT_ADDRESS>

echo "=== SchedulerRSC Callbacks (Reactive Network) ==="
cast logs --address $SCHEDULER \
  --event "Callback(uint256,address,uint64,bytes)" \
  --rpc-url reactive_lasna \
  | jq 'length'

echo "=== AutoYieldVault Events (Sepolia) ==="
cast logs --address $VAULT \
  --event "RebalancingTriggered(address,uint256,uint256)" \
  --rpc-url sepolia \
  | jq 'length'

echo "Events should match or Sepolia count should be close to Reactive count"
```

## 🎯 Quick Reference

### Complete Deployment Workflow (From Scratch)

**Step 1: Deploy AutoYieldVault to Sepolia**
```bash
# Load environment
source .env

# Deploy vault (owner is automatically set to deployer)
VAULT=$(forge create src/AutoYieldVault.sol:AutoYieldVault \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA \
  --value 0.01ether \
  --json | jq -r '.deployedTo')

echo "Vault deployed at: $VAULT"
echo "TARGET_VAULT=$VAULT" >> .env
```

**Step 2: Deploy SchedulerRSC to Reactive Network**
```bash
# Load updated .env with vault address
source .env

# Deploy scheduler (subscription happens automatically)
SCHEDULER=$(forge create src/SchedulerRSC.sol:SchedulerRSC \
  --broadcast \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE \
  --value 0.1ether \
  --constructor-args $TARGET_VAULT $INTERVAL \
  --json | jq -r '.deployedTo')

echo "Scheduler deployed at: $SCHEDULER"
```

**Step 3: Verify Integration**
```bash
# Watch for events (in separate terminal)
cast logs --address $VAULT \
  --event "RebalancingTriggered(address,uint256,uint256)" \
  --rpc-url sepolia \
  --follow
```

### Check Contract Status (One-Liners)

**AutoYieldVault Status:**
```bash
VAULT=<VAULT_ADDRESS> && \
echo "Owner: $(cast call $VAULT 'owner()(address)' --rpc-url sepolia)"
```

**SchedulerRSC Status:**
```bash
SCHEDULER=<SCHEDULER_ADDRESS> && \
echo "Interval: $(cast call $SCHEDULER 'interval()(uint256)' --rpc-url reactive_lasna)" && \
echo "Target Vault: $(cast call $SCHEDULER 'targetVault()(address)' --rpc-url reactive_lasna)" && \
echo "Owner: $(cast call $SCHEDULER 'owner()(address)' --rpc-url reactive_lasna)" && \
echo "Balance: $(cast balance $SCHEDULER --rpc-url reactive_lasna --ether) REACT"
```

### Manual Trigger (Testing)

```bash
# Manually trigger rebalancing from any address
cast send <VAULT_ADDRESS> "checkAndRebalance()" \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY_SEPOLIA

# Check event was emitted
cast logs --address <VAULT_ADDRESS> \
  --event "RebalancingTriggered(address,uint256,uint256)" \
  --rpc-url sepolia \
  | tail -1
```

## 📚 Additional Resources

- [Reactive Network Docs](https://dev.reactive.network/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Lasna Block Explorer](https://lasna.reactscan.net)
- [Sepolia Etherscan](https://sepolia.etherscan.io)

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs with `-vvvv` flag
3. Check block explorer for transaction details
4. Open an issue on GitHub

---

**Security Note:** Never share your private key or commit it to Git. Always use test wallets for testnet deployments.