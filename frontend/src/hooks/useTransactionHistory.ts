import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { formatTimestamp } from '@/utils/transactionHelpers';

export interface TransactionRecord {
    id: string;
    txNumber: number;
    reactiveHash: string;
    sepoliaHash: string;
    timestamp: string;
    status: 'success' | 'failed';
    destinationChain: string;
    blockNumber: number;
}

export interface UseTransactionHistoryReturn {
    transactions: TransactionRecord[];
    isLoading: boolean;
    error: string | null;
}

// SchedulerRSC contract on Reactive Network (Lasna Testnet)
const SCHEDULER_RSC = '0x76E2618fbF423528ed3dF070024D445eCc71421E';

// Reactive Network RPC URL
const REACTIVE_RPC = 'https://lasna-rpc.rnk.dev/';

// Callback event signature
const CALLBACK_EVENT_TOPIC = ethers.id('Callback(uint256,address,uint64,bytes)');

// Real transaction data from Reactive Network callbacks to Sepolia
// RVM Address: 0x75b3aee6908d0447dd598bf183bdc955ae280ca1
const MOCK_TRANSACTIONS: TransactionRecord[] = [
    {
        id: '1',
        txNumber: 49,
        reactiveHash: '0xfe5e48caca2a179ae807a73492fea41cca20ac0248acb9e8fdb0679a888026e6',
        sepoliaHash: '0x717b361935c68b1a4f2d0c51f2d3547e26788656234122024ecf250dc75999f3',
        timestamp: '2025-12-26 12:09:12',
        status: 'success',
        destinationChain: 'Sepolia',
        blockNumber: 9918025,
    },
    {
        id: '2',
        txNumber: 48,
        reactiveHash: '0xb7d2de7797aefde21d3f1bf945f0baf577d37f1444ac5745fec784feaae475e0',
        sepoliaHash: '0xe45e3694cfc420ec047100cf03ee5ae37e04dff9591ed44bada12e71fbe9bbab',
        timestamp: '2025-12-26 11:57:12',
        status: 'success',
        destinationChain: 'Sepolia',
        blockNumber: 9917972,
    },
    {
        id: '3',
        txNumber: 47,
        reactiveHash: '0xdc0879e6f3d37e15e45b020119b6da757595bc0c0accf57013707b80b6267f83',
        sepoliaHash: '0x57ea838365d7b004d8d2951f79911ef1d864b874a2b7ed59ec7c2ee843f15d7e',
        timestamp: '2025-12-24 22:25:24',
        status: 'success',
        destinationChain: 'Sepolia',
        blockNumber: 9908016,
    },
    {
        id: '4',
        txNumber: 46,
        reactiveHash: '0x0f59cf08514fae9db605a4a937251f5bd3f6adf7e1fd1c1357a438d46640b1b7',
        sepoliaHash: '0xc193f06e9fcfe66bbc1a89d8fa4de5ffded09832318380c6580b37a7fc485aa4',
        timestamp: '2025-12-24 22:13:36',
        status: 'success',
        destinationChain: 'Sepolia',
        blockNumber: 9907964,
    },
    {
        id: '5',
        txNumber: 45,
        reactiveHash: '0xbe3ceeb84df5479631a7deba5b5337d4892b41d01ed787060c89efb45ed5b596',
        sepoliaHash: '0xfe94034ca0a85ecfabfccffe4bce8125d168ed36c64531590054e3bb9ef3c04c',
        timestamp: '2025-12-24 22:02:00',
        status: 'success',
        destinationChain: 'Sepolia',
        blockNumber: 9907909,
    },
    {
        id: '6',
        txNumber: 44,
        reactiveHash: '0x059314ef0567523f825f9a652e305ea4284f4ba1973e95bced2f8c09d22618ac',
        sepoliaHash: '0x70d771c6219d76c7a5328a0abd214bf9e5bfb2188f82211a65dd32d613a713fe',
        timestamp: '2025-12-24 21:50:24',
        status: 'success',
        destinationChain: 'Sepolia',
        blockNumber: 9907854,
    },
];

export const useTransactionHistory = (): UseTransactionHistoryReturn => {
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Simulate loading for demo
        const timer = setTimeout(() => {
            setTransactions(MOCK_TRANSACTIONS);
            setIsLoading(false);
        }, 800);

        return () => clearTimeout(timer);
    }, []);

    return { transactions, isLoading, error };
};
