import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Wallet, 
  TrendingUp, 
  Activity, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  RefreshCw,
  Pause,
  Play
} from 'lucide-react';

// ========== TYPES ==========

interface PoolConfig {
  name: string;
  logo: string;
  color: string;
}

interface ContractData {
  bestPool: string;
  bestRate: bigint;
  currentRate: bigint;
  shouldRebalance: boolean;
  activePool: string;
  rebalanceThreshold: bigint;
  allPools: {
    address: string;
    rate: bigint;
    success: boolean;
  }[];
  totalValueLocked: bigint;
  isLoading: boolean;
  error: string | null;
}

// ========== CONSTANTS ==========

// Deployed Contract Addresses (Sepolia)
const AUTO_YIELD_VAULT = '0xc8F25cf0aB99e77D8671301c2f19B03554F80B5b';
const SCHEDULER_RSC = '0xa2Ff933482F45C3159fBbfe28a1a65e7e7b5912E';
const AAVE_POOL = '0x1DbaE63b3a7dd56438eCd25c1816d53E519b6720';
const SPARK_POOL = '0x548a8308464bDF1F96409ef684537137bcd0C7E2';
const COMPOUND_COMET = '0x985d3d497f39C7359DC535205b3b1c7e49063A5B';

// Pool Configuration Mapping
const POOLS_CONFIG: Record<string, PoolConfig> = {
  [AAVE_POOL.toLowerCase()]: {
    name: 'Aave V3',
    logo: '🔷',
    color: '#627eea',
  },
  [SPARK_POOL.toLowerCase()]: {
    name: 'SparkLend',
    logo: '⚡',
    color: '#ff6b35',
  },
  [COMPOUND_COMET.toLowerCase()]: {
    name: 'Compound',
    logo: '🟢',
    color: '#0aff00',
  },
};

// Sepolia RPC URLs
const SEPOLIA_RPCS = [
  'https://rpc.sepolia.org',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.gateway.tenderly.co',
  'https://rpc2.sepolia.org',
];

// ABIs
const VAULT_ABI = [
  'function getBestPool() external view returns (address bestPool, uint256 bestRate, uint256 currentRate, bool shouldRebalance)',
  'function getAllPoolRates() external view returns (address[] memory pools, uint256[] memory rates, bool[] memory successes)',
  'function activePool() external view returns (address)',
  'function rebalanceThresholdRay() external view returns (uint256)',
  'function manualRebalance() external',
  'function deposit(uint256 amount) external',
  'function withdraw(uint256 amount) external',
];

const SCHEDULER_ABI = [
  'function pause() external',
  'function resume() external',
  'function paused() external view returns (bool)',
];

// ========== UTILITY FUNCTIONS ==========

// Convert Ray (1e27) to percentage
const rayToPercent = (rayValue: bigint): string => {
  try {
    const percent = Number(rayValue) / 1e25;
    return percent.toFixed(2);
  } catch {
    return '0.00';
  }
};

// Get pool config by address
const getPoolConfig = (address: string): PoolConfig => {
  return POOLS_CONFIG[address.toLowerCase()] || {
    name: 'Unknown Pool',
    logo: '❓',
    color: '#666666',
  };
};

// ========== MAIN COMPONENT ==========

export default function Dashboard() {
  const [contractData, setContractData] = useState<ContractData>({
    bestPool: '',
    bestRate: 0n,
    currentRate: 0n,
    shouldRebalance: false,
    activePool: '',
    rebalanceThreshold: 0n,
    allPools: [],
    totalValueLocked: 10000000000n, // Mock 10,000 USDT (6 decimals)
    isLoading: true,
    error: null,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [blocksUntilCron, setBlocksUntilCron] = useState(45);
  const [isRebalancing, setIsRebalancing] = useState(false);

  // Fetch contract data
  useEffect(() => {
    const fetchData = async () => {
      let lastError: Error | null = null;

      for (let i = 0; i < SEPOLIA_RPCS.length; i++) {
        try {
          const provider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[i]);
          const vaultContract = new ethers.Contract(AUTO_YIELD_VAULT, VAULT_ABI, provider);

          const [bestPool, bestRate, currentRate, shouldRebalance] = await vaultContract.getBestPool();
          const [pools, rates, successes] = await vaultContract.getAllPoolRates();
          const activePool = await vaultContract.activePool();
          const threshold = await vaultContract.rebalanceThresholdRay();

          const allPools = pools.map((addr: string, idx: number) => ({
            address: addr,
            rate: rates[idx],
            success: successes[idx],
          }));

          setContractData({
            bestPool,
            bestRate,
            currentRate,
            shouldRebalance,
            activePool,
            rebalanceThreshold: threshold,
            allPools,
            totalValueLocked: 10000000000n,
            isLoading: false,
            error: null,
          });

          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error');
        }
      }

      setContractData(prev => ({
        ...prev,
        isLoading: false,
        error: lastError?.message || 'Failed to fetch data',
      }));
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Block countdown simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setBlocksUntilCron(prev => (prev <= 1 ? 50 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate profit delta
  const profitDelta = contractData.bestRate > contractData.currentRate
    ? Number(contractData.bestRate - contractData.currentRate) / 1e25
    : 0;

  const activePoolConfig = getPoolConfig(contractData.activePool);
  const bestPoolConfig = getPoolConfig(contractData.bestPool);

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%2300f3ff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#00f3ff]/20 bg-black/60 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Zap className="w-10 h-10 text-[#00f3ff]" />
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00f3ff] to-[#0aff00] bg-clip-text text-transparent">
                  Reactive Yield Optimizer
                </h1>
                <p className="text-xs text-gray-500 font-mono">Automated Cross-Chain DeFi Vault</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#0aff00]/10 border border-[#0aff00]/30 rounded-lg">
                <div className="w-2 h-2 bg-[#0aff00] rounded-full animate-pulse" />
                <span className="text-xs text-[#0aff00] font-mono font-bold">SEPOLIA TESTNET</span>
              </div>
              <Button className="bg-gradient-to-r from-[#00f3ff] to-[#0aff00] text-black font-bold hover:shadow-[0_0_30px_rgba(0,243,255,0.6)] transition-all">
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard - 3 Columns */}
      <main className="relative z-10 container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ========== COLUMN 1: THE VAULT ========== */}
          <Card className="bg-black/40 border-[#627eea]/30 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Database className="w-5 h-5 text-[#627eea]" />
              <h2 className="text-xl font-bold text-[#627eea]">THE VAULT</h2>
            </div>

            {contractData.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-[#00f3ff] animate-spin" />
              </div>
            ) : contractData.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                {contractData.error}
              </div>
            ) : (
              <div className="space-y-6">
                {/* TVL */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Value Locked</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-mono text-white">
                      ${(Number(contractData.totalValueLocked) / 1e6).toLocaleString()}
                    </span>
                    <span className="text-lg text-gray-400">USDT</span>
                  </div>
                </div>

                {/* Current APY */}
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current APY</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold font-mono text-[#0aff00]">
                      {rayToPercent(contractData.currentRate)}%
                    </span>
                  </div>
                </div>

                {/* Active Pool */}
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Active Pool</p>
                  <div 
                    className="bg-gradient-to-br from-black/60 to-black/40 rounded-xl p-4 border-2 transition-all"
                    style={{ borderColor: activePoolConfig.color }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{activePoolConfig.logo}</span>
                      <div>
                        <p className="font-bold text-lg" style={{ color: activePoolConfig.color }}>
                          {activePoolConfig.name}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">{contractData.activePool.slice(0, 10)}...</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t border-gray-800 pt-4 space-y-3">
                  <Button className="w-full bg-gradient-to-r from-[#00f3ff] to-[#0aff00] text-black font-bold hover:shadow-[0_0_20px_rgba(0,243,255,0.5)]">
                    <ArrowDownRight className="w-4 h-4 mr-2" />
                    Deposit USDT
                  </Button>
                  <Button className="w-full bg-black/60 border-2 border-[#00f3ff] text-[#00f3ff] font-bold hover:bg-[#00f3ff]/10">
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Withdraw USDT
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ========== COLUMN 2: MARKET MONITOR ========== */}
          <Card className="bg-black/40 border-[#0aff00]/30 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-[#0aff00]" />
              <h2 className="text-xl font-bold text-[#0aff00]">MARKET MONITOR</h2>
            </div>

            {contractData.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-[#00f3ff] animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pool List */}
                {contractData.allPools.map((pool, idx) => {
                  const config = getPoolConfig(pool.address);
                  const isActive = pool.address.toLowerCase() === contractData.activePool.toLowerCase();
                  const isBest = pool.address.toLowerCase() === contractData.bestPool.toLowerCase();

                  return (
                    <div
                      key={pool.address}
                      className={`bg-black/60 rounded-xl p-4 border-2 transition-all ${
                        isActive
                          ? 'border-[#627eea] shadow-lg shadow-[#627eea]/20'
                          : isBest && contractData.shouldRebalance
                          ? 'border-[#0aff00] shadow-lg shadow-[#0aff00]/20 animate-pulse'
                          : 'border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{config.logo}</span>
                          <div>
                            <p className="font-bold text-white">{config.name}</p>
                            <p className="text-xs text-gray-500 font-mono">{pool.address.slice(0, 10)}...</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isActive && (
                            <Badge className="bg-[#627eea]/20 text-[#627eea] border-[#627eea]/50 text-xs">
                              ACTIVE
                            </Badge>
                          )}
                          {isBest && contractData.shouldRebalance && (
                            <Badge className="bg-[#0aff00]/20 text-[#0aff00] border-[#0aff00]/50 text-xs animate-pulse">
                              TARGET
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono text-[#0aff00]">
                          {rayToPercent(pool.rate)}%
                        </span>
                        <span className="text-sm text-gray-500">APY</span>
                      </div>
                    </div>
                  );
                })}

                {/* Rebalance Threshold */}
                <div className="border-t border-gray-800 pt-4 mt-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Rebalance Threshold</p>
                  <div className="bg-black/60 rounded-lg p-3 border border-[#00f3ff]/30">
                    <p className="text-2xl font-bold font-mono text-[#00f3ff]">
                      {rayToPercent(contractData.rebalanceThreshold)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ========== COLUMN 3: REACTIVE SCHEDULER ========== */}
          <Card className="bg-black/40 border-[#00f3ff]/30 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-[#00f3ff]" />
              <h2 className="text-xl font-bold text-[#00f3ff]">REACTIVE SCHEDULER</h2>
            </div>

            <div className="space-y-6">
              {/* Circular Progress Timer */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 text-center">Next Cron Check</p>
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#1a1a1a"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#00f3ff"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - blocksUntilCron / 50)}`}
                        className="transition-all duration-1000"
                        style={{ filter: 'drop-shadow(0 0 10px #00f3ff)' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl font-bold font-mono text-[#00f3ff]">{blocksUntilCron}</p>
                        <p className="text-xs text-gray-500">blocks</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decision Matrix */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Decision Matrix</p>
                <div className="space-y-3">
                  <div className="bg-black/60 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Current Rate</p>
                    <p className="text-xl font-bold font-mono text-[#627eea]">
                      {rayToPercent(contractData.currentRate)}%
                    </p>
                  </div>
                  <div className="bg-black/60 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Best Potential Rate</p>
                    <p className="text-xl font-bold font-mono text-[#0aff00]">
                      {rayToPercent(contractData.bestRate)}%
                    </p>
                  </div>
                  <div className="bg-black/60 rounded-lg p-3 border border-[#00f3ff]/50">
                    <p className="text-xs text-gray-500 mb-1">Profit Delta</p>
                    <p className="text-xl font-bold font-mono text-[#00f3ff]">
                      +{profitDelta.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Box */}
              <div className="border-t border-gray-800 pt-4">
                {contractData.shouldRebalance ? (
                  <div className="bg-gradient-to-br from-[#0aff00]/20 to-black/60 border-2 border-[#0aff00] rounded-xl p-4 shadow-[0_0_30px_rgba(10,255,0,0.3)]">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-[#0aff00] animate-pulse" />
                      <p className="font-bold text-[#0aff00] text-lg">REBALANCE REQUIRED</p>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                      Target: {bestPoolConfig.name} ({rayToPercent(contractData.bestRate)}%)
                    </p>
                    <Button 
                      className="w-full bg-gradient-to-r from-[#0aff00] to-[#00f3ff] text-black font-bold hover:shadow-[0_0_20px_rgba(10,255,0,0.6)]"
                      disabled={isRebalancing}
                    >
                      {isRebalancing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Rebalancing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Force Rebalance
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-[#00f3ff]/20 to-black/60 border-2 border-[#00f3ff] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-[#00f3ff]" />
                      <p className="font-bold text-[#00f3ff] text-lg">YIELD OPTIMIZED</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      Currently in best pool: {activePoolConfig.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Scheduler Controls */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Scheduler Controls</p>
                <div className="space-y-2">
                  <Button 
                    className="w-full bg-black/60 border-2 border-yellow-500 text-yellow-500 font-bold hover:bg-yellow-500/10"
                    onClick={() => setIsPaused(!isPaused)}
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Resume Automation
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Automation
                      </>
                    )}
                  </Button>
                  <div className="bg-black/60 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Scheduler RSC</p>
                    <p className="text-xs font-mono text-gray-400 break-all">{SCHEDULER_RSC}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
