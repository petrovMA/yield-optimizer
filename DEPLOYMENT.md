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

## 📦 Deploy Mock Contracts to Sepolia

If you haven't deployed the vault and mock pools yet, here's how:

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

### Verify on Lasna Reactscan

Unfortunately, Foundry's `--verify` flag doesn't work with Reactive Network yet. Manual verification:

1. Go to: https://lasna.reactscan.net/address/<CONTRACT_ADDRESS>
2. Click "Contract" tab
3. Click "Verify & Publish"
4. Upload the source code

### Verify on Sepolia Etherscan

If you used `--verify` during deployment, it should be automatic. Otherwise:

```bash
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/MockToken.sol:MockToken \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string)" "USDT Mock" "USDT")
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

### Watch for Callback Events

Monitor when your scheduler sends callbacks to Sepolia:

```bash
# Watch for Callback events
cast logs \
  --address <SCHEDULER_ADDRESS> \
  --rpc-url reactive_lasna
```

### Check Callback History

On Sepolia, check if callbacks are being executed:

```bash
# Watch for transactions to your vault
cast logs \
  --address <VAULT_ADDRESS> \
  --rpc-url sepolia
```

## 🎯 Quick Reference

### Deploy to Lasna Testnet (Complete Process)

```bash
# Load environment variables
source .env

# Deploy contract (subscription happens automatically)
forge create src/SchedulerRSC.sol:SchedulerRSC \
  --broadcast \
  --rpc-url reactive_lasna \
  --private-key $PRIVATE_KEY_REACTIVE \
  --value 0.1ether \
  --constructor-args $TARGET_VAULT $INTERVAL
```

### Check Contract Status (One-Liner)

```bash
ADDR=<SCHEDULER_ADDRESS> && \
echo "Interval: $(cast call $ADDR 'interval()(uint256)' --rpc-url reactive_lasna)" && \
echo "Target Vault: $(cast call $ADDR 'targetVault()(address)' --rpc-url reactive_lasna)" && \
echo "Owner: $(cast call $ADDR 'owner()(address)' --rpc-url reactive_lasna)" && \
echo "Balance: $(cast balance $ADDR --rpc-url reactive_lasna --ether) REACT"
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