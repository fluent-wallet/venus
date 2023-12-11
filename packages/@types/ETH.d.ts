declare namespace ETH {
  export interface eth_getTransactionByHashResponse {
    blockHash?: string | null;
    blockNumber?: string | null;
    from?: string | null;
    gas?: string | null;
    gasPrice?: string | null;
    hash?: string | null;
    input?: string | null;
    nonce?: string | null;
    to?: string | null;
    transactionIndex?: string | null;
    value?: string | null;
    v?: string | null;
    r?: string | null;
    s?: string | null;
  }

  export interface eth_getTransactionReceiptResponse {
    blockHash?: string | null;
    blockNumber?: string | null;
    contractAddress?: string | null;
    cumulativeGasUsed?: string | null;
    effectiveGasPrice?: string | null;
    from?: string | null;
    gasUsed?: string | null;
    status?: string | null;
    to?: string | null;
    transactionHash?: string | null;
    transactionIndex?: string | null;
    type?: string | null;
    logs: unknown[];
    logsBloom?: string | null;
  }
}
