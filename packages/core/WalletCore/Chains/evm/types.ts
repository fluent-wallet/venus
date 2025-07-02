export type IEncodedTxEvm = {
  from: string;
  to: string;
  value: string;
  data?: string;
  customData?: string;
  nonce?: number;

  gas?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;

  chainId?: string;

  // EIP-2930
  accessList?: {
    address: string;
    storageKeys: string[];
  }[];
};
