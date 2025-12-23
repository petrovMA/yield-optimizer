import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export interface ContractPoolData {
  address: string;
  rate: string;
  rateRaw: string;
  success: boolean;
}

export interface ContractData {
  bestPool: string;
  bestRate: string;
  currentRate: string;
  shouldRebalance: boolean;
  activePool: string;
  rebalanceThreshold: string;
  allPools: ContractPoolData[];
  isLoading: boolean;
  error: string | null;
}

// Deployed Contract Addresses (Sepolia)
const AUTO_YIELD_VAULT = '0xc8F25cf0aB99e77D8671301c2f19B03554F80B5b';
const AAVE_POOL = '0x1DbaE63b3a7dd56438eCd25c1816d53E519b6720';
const SPARK_POOL = '0x548a8308464bDF1F96409ef684537137bcd0C7E2';
const COMPOUND_COMET = '0x985d3d497f39C7359DC535205b3b1c7e49063A5B';

const POOL_ADDRESSES = [
  AAVE_POOL,
  SPARK_POOL,
  COMPOUND_COMET,
];

// Sepolia RPC URLs (fallback list)
const SEPOLIA_RPCS = [
  'https://rpc.sepolia.org',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.gateway.tenderly.co',
  'https://rpc2.sepolia.org',
];

let currentRpcIndex = 0;

// AutoYieldVault ABI (only view functions we need)
const VAULT_ABI = [
  'function getBestPool() external view returns (address bestPool, uint256 bestRate, uint256 currentRate, bool shouldRebalance)',
  'function getAllPoolRates() external view returns (address[] memory pools, uint256[] memory rates, bool[] memory successes)',
  'function activePool() external view returns (address)',
  'function rebalanceThresholdRay() external view returns (uint256)',
];

// Convert Ray (1e27) to percentage
const rayToPercent = (rayValue: bigint): string => {
  try {
    // Convert Ray to percentage: divide by 1e25 (1e27 / 1e2)
    const percent = Number(rayValue) / 1e25;
    return percent.toFixed(2);
  } catch {
    return '0.00';
  }
};

// Convert Ray to string for display
const rayToString = (rayValue: bigint): string => {
  return rayValue.toString();
};

export const useContractData = () => {
  const [data, setData] = useState<ContractData>({
    bestPool: '',
    bestRate: '0',
    currentRate: '0',
    shouldRebalance: false,
    activePool: '',
    rebalanceThreshold: '0.50',
    allPools: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchContractData = async () => {
      let lastError: Error | null = null;
      
      // Try each RPC endpoint until one works
      for (let i = 0; i < SEPOLIA_RPCS.length; i++) {
        const rpcIndex = (currentRpcIndex + i) % SEPOLIA_RPCS.length;
        const rpcUrl = SEPOLIA_RPCS[rpcIndex];
        
        try {
          // Create provider (Sepolia)
          const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Create contract instance
        const vaultContract = new ethers.Contract(
          AUTO_YIELD_VAULT,
          VAULT_ABI,
          provider
        );

        // Call getBestPool()
        const [bestPool, bestRateRaw, currentRateRaw, shouldRebalance] = await vaultContract.getBestPool();
        
        // Call getAllPoolRates()
        const [pools, rates, successes] = await vaultContract.getAllPoolRates();
        
        // Get active pool
        const activePool = await vaultContract.activePool();
        
        // Get rebalance threshold
        const thresholdRaw = await vaultContract.rebalanceThresholdRay();

        // Convert rates from Ray to percentage
        const bestRate = rayToPercent(bestRateRaw);
        const currentRate = rayToPercent(currentRateRaw);
        const rebalanceThreshold = rayToPercent(thresholdRaw);

        // Process all pool rates
        const allPools: ContractPoolData[] = pools.map((poolAddress: string, idx: number) => ({
          address: poolAddress,
          rate: rayToPercent(rates[idx]),
          rateRaw: rayToString(rates[idx]),
          success: successes[idx],
        }));

          setData({
            bestPool,
            bestRate,
            currentRate,
            shouldRebalance,
            activePool,
            rebalanceThreshold,
            allPools,
            isLoading: false,
            error: null,
          });
          
          // Success - update current RPC index for next time
          currentRpcIndex = rpcIndex;
          return; // Exit the function on success
          
        } catch (err) {
          console.warn(`RPC ${rpcUrl} failed:`, err);
          lastError = err instanceof Error ? err : new Error('Unknown error');
          // Continue to next RPC
        }
      }
      
      // All RPCs failed
      console.error('All RPC endpoints failed. Last error:', lastError);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: lastError?.message || 'All RPC endpoints failed. Please try again later.',
      }));
    };

    // Initial fetch
    fetchContractData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchContractData, 30000);

    return () => clearInterval(interval);
  }, []);

  return data;
};
