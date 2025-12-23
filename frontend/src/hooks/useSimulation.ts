import { useState, useEffect, useCallback } from 'react';

export interface Pool {
  id: string;
  name: string;
  protocol: string;
  apy: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  chain: string;
  eventType: string;
  details: string;
}

export interface SimulationState {
  pools: Pool[];
  activePoolId: string;
  totalValueLocked: number;
  currentYield: number;
  blocksUntilRebalance: number;
  isRebalancing: boolean;
  conditionMet: boolean;
  activityLogs: ActivityLog[];
}

const REBALANCE_THRESHOLD = 2.0; // 2% difference triggers rebalance
const BLOCKS_PER_CYCLE = 50;

export const useSimulation = () => {
  const [state, setState] = useState<SimulationState>({
    pools: [
      { id: 'pool-a', name: 'Pool A', protocol: 'SparkLend', apy: 5.2, trend: 'stable' },
      { id: 'pool-b', name: 'Pool B', protocol: 'Aave V3', apy: 4.8, trend: 'stable' },
      { id: 'pool-c', name: 'Pool C', protocol: 'Compound', apy: 3.9, trend: 'stable' },
    ],
    activePoolId: 'pool-a',
    totalValueLocked: 10000,
    currentYield: 5.2,
    blocksUntilRebalance: 45,
    isRebalancing: false,
    conditionMet: false,
    activityLogs: [],
  });

  const addLog = useCallback((chain: string, eventType: string, details: string) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      chain,
      eventType,
      details,
    };

    setState(prev => ({
      ...prev,
      activityLogs: [newLog, ...prev.activityLogs].slice(0, 20), // Keep last 20 logs
    }));
  }, []);

  // Fluctuate APY every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const updatedPools = prev.pools.map(pool => {
          const change = (Math.random() - 0.5) * 0.8; // ±0.4% change
          const newApy = Math.max(2, Math.min(8, pool.apy + change));
          const trend: 'up' | 'down' | 'stable' = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable';
          
          if (Math.abs(newApy - pool.apy) > 0.1) {
            addLog('Sepolia', 'Rate Update', `${pool.protocol} rate updated to ${newApy.toFixed(2)}%`);
          }
          
          return { ...pool, apy: newApy, trend };
        });

        return { ...prev, pools: updatedPools };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [addLog]);

  // Block countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const newBlocks = prev.blocksUntilRebalance - 1;
        
        if (newBlocks <= 0) {
          addLog('Reactive', 'Cron Job', `Triggered (Block #${49200 + Math.floor(Math.random() * 1000)})`);
          return { ...prev, blocksUntilRebalance: BLOCKS_PER_CYCLE };
        }
        
        return { ...prev, blocksUntilRebalance: newBlocks };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [addLog]);

  // Check rebalance condition
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        if (prev.isRebalancing) return prev;

        const activePool = prev.pools.find(p => p.id === prev.activePoolId);
        const highestPool = [...prev.pools].sort((a, b) => b.apy - a.apy)[0];

        if (!activePool || !highestPool) return prev;

        const spread = highestPool.apy - activePool.apy;
        const conditionMet = spread > REBALANCE_THRESHOLD;

        if (conditionMet && prev.activePoolId !== highestPool.id) {
          // Trigger rebalance
          addLog('Reactive', 'Logic Check', `Rate Diff ${spread.toFixed(2)}% > ${REBALANCE_THRESHOLD}%. Initiating Callback...`);
          
          setTimeout(() => {
            setState(current => {
              addLog('Sepolia', 'Vault Action', `Withdrawing from ${activePool.protocol} → Supplying to ${highestPool.protocol}`);
              
              return {
                ...current,
                isRebalancing: true,
              };
            });

            setTimeout(() => {
              setState(current => ({
                ...current,
                activePoolId: highestPool.id,
                currentYield: highestPool.apy,
                isRebalancing: false,
                conditionMet: false,
              }));
              
              addLog('Sepolia', 'Rebalance Complete', `Vault now active in ${highestPool.protocol} at ${highestPool.apy.toFixed(2)}% APY`);
            }, 2000);
          }, 500);

          return { ...prev, conditionMet: true };
        }

        return { ...prev, conditionMet };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [addLog]);

  return state;
};
