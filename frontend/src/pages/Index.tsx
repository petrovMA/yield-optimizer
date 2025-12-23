import { useSimulation } from '@/hooks/useSimulation';
import { useContractData } from '@/hooks/useContractData';
import { Activity, Zap, TrendingUp, TrendingDown, Minus, Wallet, Database, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function Index() {
  const simulation = useSimulation();
  const contractData = useContractData();

  const activePool = simulation.pools.find(p => p.id === simulation.activePoolId);
  const highestPool = [...simulation.pools].sort((a, b) => b.apy - a.apy)[0];
  const spread = highestPool && activePool ? highestPool.apy - activePool.apy : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Hex Grid Background */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%2300f3ff' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-cyan-500/20 bg-black/40 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Zap className="w-8 h-8 text-[#00f3ff]" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00f3ff] to-[#627eea] bg-clip-text text-transparent">
              Reactive Yield Optimizer
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#0aff00] rounded-full animate-pulse" />
              <span className="text-sm text-gray-400 font-mono">SYSTEM ONLINE</span>
            </div>
            <Button className="bg-gradient-to-b from-gray-800/80 to-gray-900/80 border-4 border-[#00f3ff] text-[#00f3ff] hover:shadow-[0_0_30px_rgba(0,243,255,0.6)] transition-all duration-300 shadow-[0_0_20px_rgba(0,243,255,0.4)] rounded-2xl font-bold uppercase">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="relative z-10 container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Zone A: The Vault */}
          <Card className="bg-gradient-to-br from-[#627eea]/10 to-black/40 border-[#627eea]/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-[#627eea] rounded-full" />
              <h2 className="text-lg font-bold text-[#627eea]">THE VAULT</h2>
              <Badge variant="outline" className="ml-auto border-[#627eea]/50 text-[#627eea]">
                Sepolia Origin
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Value Locked</p>
                <p className="text-3xl font-bold font-mono text-white">
                  ${simulation.totalValueLocked.toLocaleString()} <span className="text-lg text-gray-400">USDT</span>
                </p>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Active Pool</p>
                <div className="bg-black/40 rounded-lg p-3 border border-[#627eea]/50">
                  <p className="font-mono text-sm text-gray-400">{activePool?.name}</p>
                  <p className="font-bold text-white">{activePool?.protocol}</p>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Yield</p>
                <p className="text-4xl font-bold font-mono text-[#0aff00] flex items-baseline gap-2">
                  {simulation.currentYield.toFixed(2)}%
                  <span className="text-sm text-gray-400">APY</span>
                </p>
              </div>

              {simulation.isRebalancing && (
                <div className="bg-gradient-to-b from-gray-800/80 to-gray-900/80 border-4 border-[#00f3ff] rounded-2xl p-4 shadow-[0_0_30px_rgba(0,243,255,0.4)]">
                  <p className="text-[#00f3ff] font-mono text-sm flex items-center gap-2 justify-center">
                    <Activity className="w-4 h-4 animate-spin" />
                    REBALANCING IN PROGRESS...
                  </p>
                  <div className="relative h-3 bg-black/60 rounded-full overflow-hidden border-2 border-[#00f3ff]/50 mt-3">
                    <div className="h-full bg-gradient-to-r from-[#00f3ff] to-[#0aff00] relative overflow-hidden animate-pulse" style={{ width: '60%' }}>
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Zone B: Market Monitor */}
          <Card className="bg-gradient-to-br from-[#0aff00]/10 to-black/40 border-[#0aff00]/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-[#0aff00] rounded-full" />
              <h2 className="text-lg font-bold text-[#0aff00]">MARKET MONITOR</h2>
              <Badge variant="outline" className="ml-auto border-[#0aff00]/50 text-[#0aff00]">
                Live Data
              </Badge>
            </div>

            <div className="space-y-3">
              {simulation.pools.map(pool => {
                const isActive = pool.id === simulation.activePoolId;
                const isHighest = pool.id === highestPool?.id;

                return (
                  <div
                    key={pool.id}
                    className={`bg-black/40 rounded-lg p-4 border transition-all ${
                      isActive
                        ? 'border-[#627eea] shadow-lg shadow-[#627eea]/20'
                        : isHighest
                        ? 'border-[#0aff00] shadow-lg shadow-[#0aff00]/20'
                        : 'border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-mono text-xs text-gray-500">{pool.name}</p>
                        <p className="font-bold text-white">{pool.protocol}</p>
                      </div>
                      {pool.trend === 'up' && <TrendingUp className="w-5 h-5 text-[#0aff00]" />}
                      {pool.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                      {pool.trend === 'stable' && <Minus className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-2xl font-bold font-mono ${
                        isHighest ? 'text-[#0aff00]' : 'text-white'
                      }`}>
                        {pool.apy.toFixed(2)}%
                      </p>
                      <span className="text-xs text-gray-500">APY</span>
                    </div>
                    {isActive && (
                      <Badge className="mt-2 bg-[#627eea]/20 text-[#627eea] border-[#627eea]/50">
                        ACTIVE
                      </Badge>
                    )}
                    {isHighest && !isActive && (
                      <Badge className="mt-2 bg-[#0aff00]/20 text-[#0aff00] border-[#0aff00]/50">
                        HIGHEST
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Zone C: Reactive Cron Controller */}
          <Card className="bg-gradient-to-br from-[#00f3ff]/10 to-black/40 border-[#00f3ff]/30 backdrop-blur-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-[#00f3ff] rounded-full" />
              <h2 className="text-lg font-bold text-[#00f3ff]">REACTIVE CRON</h2>
              <Badge variant="outline" className="ml-auto border-[#00f3ff]/50 text-[#00f3ff]">
                The Brain
              </Badge>
            </div>

            <div className="space-y-6">
              {/* Cron Timer */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Next Rebalance Check</p>
                <div className="relative">
                  <div className="flex items-center justify-center mb-2">
                    <div className="text-5xl font-bold font-mono text-[#00f3ff]">
                      {simulation.blocksUntilRebalance}
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-400 mb-3">blocks remaining</p>
                  
                  {/* Progress bar styled like the reference image */}
                  <div className="relative h-8 bg-gradient-to-b from-gray-800/80 to-gray-900/80 rounded-xl overflow-hidden border-4 border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.4)]">
                    <div 
                      className="h-full bg-gradient-to-r from-[#00f3ff]/90 to-[#00f3ff]/70 relative overflow-hidden transition-all duration-500 shadow-[inset_0_0_15px_rgba(0,243,255,0.6)]"
                      style={{ width: `${((50 - simulation.blocksUntilRebalance) / 50) * 100}%` }}
                    >
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgba(255,255,255,0.2)_8px,rgba(255,255,255,0.2)_16px)]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* State Cache */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">RSC Local View</p>
                <div className="bg-black/60 rounded-lg p-3 border border-[#00f3ff]/30 font-mono text-xs space-y-1">
                  {simulation.pools.map(pool => (
                    <div key={pool.id} className="flex justify-between">
                      <span className="text-gray-400">{pool.protocol}:</span>
                      <span className="text-[#00f3ff]">{pool.apy.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trigger Status */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Trigger Status</p>
                <div className={`rounded-2xl p-4 border-4 font-mono text-sm ${
                  simulation.conditionMet
                    ? 'bg-gradient-to-b from-gray-800/80 to-gray-900/80 border-[#0aff00] text-[#0aff00] shadow-[0_0_30px_rgba(10,255,0,0.4)]'
                    : 'bg-gradient-to-b from-gray-800/80 to-gray-900/80 border-red-500 text-red-500 shadow-[0_0_20px_rgba(255,0,85,0.3)]'
                }`}>
                  {simulation.conditionMet ? (
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 animate-pulse" />
                      <span>YES → Rebalancing...</span>
                    </div>
                  ) : (
                    <span>NO (Spread {spread.toFixed(2)}% &lt; 2.0%)</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Contract Data Section */}
        <Card className="bg-black/60 border-[#0aff00]/20 backdrop-blur-md mb-6">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#0aff00]" />
              <h2 className="text-lg font-bold text-[#0aff00] font-mono">CONTRACT VIEW FUNCTIONS</h2>
              <Badge variant="outline" className="ml-auto border-[#0aff00]/50 text-[#0aff00] flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Auto-refresh 30s
              </Badge>
            </div>
          </div>
          
          <div className="p-6">
            {contractData.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-[#00f3ff] animate-spin" />
                <span className="ml-2 text-gray-400">Loading contract data...</span>
              </div>
            ) : contractData.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                Error: {contractData.error}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* getBestPool() Results */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[#00f3ff] uppercase tracking-wider border-b border-[#00f3ff]/30 pb-2">
                    getBestPool()
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="bg-black/40 rounded-lg p-4 border border-[#00f3ff]/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Best Pool</p>
                      <p className="font-mono text-sm text-white break-all">{contractData.bestPool}</p>
                    </div>

                    <div className="bg-black/40 rounded-lg p-4 border border-[#00f3ff]/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Best Rate (APY)</p>
                      <p className="font-mono text-2xl font-bold text-[#0aff00]">{contractData.bestRate}%</p>
                    </div>

                    <div className="bg-black/40 rounded-lg p-4 border border-[#00f3ff]/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Rate (APY)</p>
                      <p className="font-mono text-2xl font-bold text-[#627eea]">{contractData.currentRate}%</p>
                    </div>

                    <div className="bg-black/40 rounded-lg p-4 border border-[#00f3ff]/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Should Rebalance</p>
                      <div className={`rounded-xl p-3 border-2 font-mono text-sm font-bold text-center ${
                        contractData.shouldRebalance
                          ? 'bg-[#0aff00]/10 border-[#0aff00] text-[#0aff00] shadow-[0_0_20px_rgba(10,255,0,0.3)]'
                          : 'bg-red-500/10 border-red-500 text-red-500'
                      }`}>
                        {contractData.shouldRebalance ? 'TRUE ✓' : 'FALSE ✗'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* getAllPoolRates() Results */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[#00f3ff] uppercase tracking-wider border-b border-[#00f3ff]/30 pb-2">
                    getAllPoolRates()
                  </h3>
                  
                  <div className="space-y-3">
                    {contractData.allPools.map((pool, idx) => {
                      const poolNames = ['Aave V3', 'SparkLend', 'Compound'];
                      return (
                        <div 
                          key={pool.address}
                          className={`bg-black/40 rounded-lg p-4 border transition-all ${
                            pool.address.toLowerCase() === contractData.activePool.toLowerCase()
                              ? 'border-[#627eea] shadow-lg shadow-[#627eea]/20'
                              : pool.address.toLowerCase() === contractData.bestPool.toLowerCase()
                              ? 'border-[#0aff00] shadow-lg shadow-[#0aff00]/20'
                              : 'border-gray-700'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 uppercase tracking-wider">{poolNames[idx] || `Pool #${idx + 1}`}</p>
                              <p className="font-mono text-xs text-gray-400 break-all mt-1">{pool.address}</p>
                            </div>
                            {pool.address.toLowerCase() === contractData.activePool.toLowerCase() && (
                              <Badge className="bg-[#627eea]/20 text-[#627eea] border-[#627eea]/50 text-xs">
                                Active
                              </Badge>
                            )}
                            {pool.address.toLowerCase() === contractData.bestPool.toLowerCase() && (
                              <Badge className="bg-[#0aff00]/20 text-[#0aff00] border-[#0aff00]/50 text-xs">
                                Best
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-baseline gap-2 mt-3">
                            <span className="text-2xl font-bold font-mono text-white">{pool.rate}%</span>
                            <span className="text-xs text-gray-500">APY</span>
                            {!pool.success && (
                              <Badge variant="outline" className="border-red-500/50 text-red-500 text-xs ml-2">
                                Error
                              </Badge>
                            )}
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-gray-800">
                            <p className="text-xs text-gray-600">Raw (Ray): {pool.rateRaw.slice(0, 12)}...</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-black/40 rounded-lg p-4 border border-[#00f3ff]/30 mt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rebalance Threshold</p>
                    <p className="font-mono text-lg font-bold text-[#00f3ff]">{contractData.rebalanceThreshold}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Activity Log */}
        <Card className="bg-black/60 border-[#00f3ff]/20 backdrop-blur-md">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00f3ff]" />
              <h2 className="text-lg font-bold text-[#00f3ff] font-mono">TRANSACTION FEED</h2>
              <Badge variant="outline" className="ml-auto border-[#00f3ff]/50 text-[#00f3ff]">
                Live
              </Badge>
            </div>
          </div>
          
          <div className="p-4 max-h-80 overflow-y-auto">
            <div className="space-y-2 font-mono text-sm">
              {simulation.activityLogs.length === 0 ? (
                <p className="text-gray-600 text-center py-8">Waiting for events...</p>
              ) : (
                simulation.activityLogs.map(log => (
                  <div
                    key={log.id}
                    className="grid grid-cols-[100px_100px_150px_1fr] gap-4 p-2 hover:bg-[#00f3ff]/5 rounded border-l-2 border-transparent hover:border-[#00f3ff] transition-all"
                  >
                    <span className="text-gray-500">[{log.timestamp}]</span>
                    <span className={`font-bold ${
                      log.chain === 'Reactive' ? 'text-[#00f3ff]' : 'text-[#627eea]'
                    }`}>
                      [{log.chain}]
                    </span>
                    <span className="text-[#0aff00]">{log.eventType}</span>
                    <span className="text-gray-300">{log.details}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
