/**
 * Utility functions for transaction history display
 */

/**
 * Format Unix timestamp to HH:MM:SS time string
 * @param unixTime Unix timestamp in seconds
 * @returns Formatted time string (e.g., "12:34:56")
 */
export const formatTimestamp = (unixTime: number): string => {
  const date = new Date(unixTime * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Generate Reactscan URL for a transaction by RVM address and tx number
 * @param rvmAddress RVM contract address on Reactive Network
 * @param txNumber Transaction number
 * @returns Full Reactscan URL
 */
export const getReactiveScanUrl = (rvmAddress: string, txNumber: number): string => {
  return `https://lasna.reactscan.net/address/${rvmAddress}/${txNumber}`;
};

/**
 * Generate Sepolia Etherscan URL for a contract address
 * @param contractAddress Contract address on Sepolia
 * @returns Full Etherscan URL
 */
export const getSepoliaUrl = (contractAddress: string): string => {
  return `https://sepolia.etherscan.io/address/${contractAddress}`;
};

/**
 * Truncate hash for display
 * @param hash Full transaction hash
 * @returns Truncated hash (e.g., "0xabcd...1234")
 */
export const truncateHash = (hash: string): string => {
  if (!hash || hash.length < 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
};
