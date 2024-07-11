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
    logs?: unknown[];
    logsBloom?: string | null;
    status?: string | null;
    to?: string | null;
    transactionHash?: string | null;
    transactionIndex?: string | null;
    /** only for espace */
    txExecErrorMsg?: string | null;
    type?: string | null;
  }

  export interface eth_getBlockByHashResponse {
    difficulty?: string | null;
    extraData?: string | null;
    gasLimit?: string | null;
    gasUsed?: string | null;
    hash?: string | null;
    logsBloom?: string | null;
    miner?: string | null;
    mixHash?: string | null;
    nonce?: string | null;
    number?: string | null;
    parentHash?: string | null;
    receiptsRoot?: string | null;
    sha3Uncles?: string | null;
    size?: string | null;
    stateRoot?: string | null;
    timestamp?: string | null;
    totalDifficulty?: string | null;
    transactions?: unknown[];
    transactionsRoot?: string | null;
    uncles?: unknown[];
  }
}
