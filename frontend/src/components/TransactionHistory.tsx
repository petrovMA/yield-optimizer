import { Activity, RefreshCw } from 'lucide-react';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { getReactiveScanUrl, truncateHash } from '@/utils/transactionHelpers';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

// RVM contract address on Reactive Network
const RVM_ADDRESS = '0x75b3aee6908d0447dd598bf183bdc955ae280ca1';

export default function TransactionHistory() {
  const { transactions, isLoading, error } = useTransactionHistory();

  return (
    <Card className="bg-black/40 border-[#00f3ff]/20 backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#00f3ff]" />
          <h2 className="text-lg font-bold text-[#00f3ff] font-mono">
            TRANSACTION HISTORY
          </h2>
          <Badge variant="outline" className="ml-auto border-[#00f3ff]/50 text-[#00f3ff]">
            Reactive Network
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-[#00f3ff] animate-spin" />
            <span className="ml-3 text-gray-400">Loading transactions...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            <p className="font-semibold">Failed to load transactions</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && transactions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-semibold text-gray-400">No transactions found</p>
            <p className="text-sm mt-2">No Callback events detected from SchedulerRSC</p>
            <div className="mt-4 text-xs space-y-1">
              <p>• Ensure the Scheduler is not paused (check "Resume Automation" button)</p>
              <p>• Wait for the next cron interval to trigger</p>
              <p>• Contract: 0x76E2...421E on Reactive Network</p>
            </div>
          </div>
        )}

        {/* Transaction Table */}
        {!isLoading && !error && transactions.length > 0 && (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-[#00f3ff] font-mono">
                    <div className="flex flex-col">
                      <span>Reactive TX</span>
                      <span className="text-xs text-gray-500 font-normal">Origin Hash</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-[#00f3ff] font-mono">Time</TableHead>
                  <TableHead className="text-[#00f3ff] font-mono">Status</TableHead>
                  <TableHead className="text-[#00f3ff] font-mono">
                    <div className="flex flex-col">
                      <span>Callback TX</span>
                      <span className="text-xs text-gray-500 font-normal">Destination Hash</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="border-gray-800 hover:bg-[#00f3ff]/5 transition-colors"
                  >
                    {/* Transaction Hash */}
                    <TableCell>
                      <a
                        href={getReactiveScanUrl(RVM_ADDRESS, tx.txNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00f3ff] hover:underline font-mono text-sm"
                      >
                        {truncateHash(tx.reactiveHash)}
                      </a>
                    </TableCell>

                    {/* Timestamp */}
                    <TableCell className="text-gray-400 font-mono text-sm">
                      {tx.timestamp}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <Badge
                        variant={tx.status === 'success' ? 'default' : 'destructive'}
                        className={
                          tx.status === 'success'
                            ? 'bg-[#0aff00]/20 text-[#0aff00] border-[#0aff00]/50'
                            : 'bg-red-500/20 text-red-400 border-red-500/50'
                        }
                      >
                        {tx.status === 'success' ? '✓ Success' : '✗ Failed'}
                      </Badge>
                    </TableCell>

                    {/* Destination Link */}
                    <TableCell>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${tx.sepoliaHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0aff00] hover:underline font-mono text-sm flex items-center gap-1"
                      >
                        {truncateHash(tx.sepoliaHash)} →
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
