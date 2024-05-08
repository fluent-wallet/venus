declare namespace CFX {
  // https://doc.confluxnetwork.org/zh-CN/docs/core/build/json-rpc/cfx-namespace#cfx_gettransactionbyhash
  export interface cfx_getTransactionByHashResponse {
    blockHash?: string | null;
    chainId?: string | null;
    contractCreated?: string | null;
    data?: string | null;
    epochHeight?: string | null;
    from?: string | null;
    gas?: string | null;
    gasPrice?: string | null;
    hash?: string | null;
    nonce?: string | null;
    to?: string | null;
    status?: string | null;
    storageLimit?: string | null;
    transactionIndex?: string | null;
    value?: string | null;
    v?: string | null;
    r?: string | null;
    s?: string | null;
  }

  // https://doc.confluxnetwork.org/zh-CN/docs/core/build/json-rpc/cfx-namespace#cfx_gettransactionreceipt
  export interface cfx_getTransactionReceiptResponse {
    blockHash?: string | null;
    contractCreated?: string | null;
    epochNumber?: string | null;
    from?: string | null;
    gasCoveredBySponsor?: boolean | null;
    gasFee?: string | null;
    gasUsed?: string | null;
    index?: string | null;
    logs?: unknown[];
    logsBloom?: string | null;
    outcomeStatus?: string | null;
    stateRoot?: string | null;
    storageCollateralized?: string | null;
    storageCoveredBySponsor?: boolean | null;
    storageReleased?: { address: string | null; collaterals: string | null }[];
    to?: string | null;
    transactionHash?: string | null;
    txExecErrorMsg?: string | null;
  }

  // https://doc.confluxnetwork.org/zh-CN/docs/core/build/json-rpc/cfx-namespace#cfx_getblockbyhash
  export interface cfx_getBlockByHashResponse {
    adaptive?: boolean | null;
    blame?: number | null;
    // Added from Conflux-rust v1.1.5
    blockNumber?: string | null;
    custom?: unknown[];
    deferredLogsBloomHash?: string | null;
    deferredReceiptsRoot?: string | null;
    deferredStateRoot?: string | null;
    difficulty?: string | null;
    epochNumber?: string | null;
    gasLimit?: string | null;
    gasUsed?: string | null;
    hash?: string | null;
    height?: string | null;
    miner?: string | null;
    nonce?: string | null;
    parentHash?: string | null;
    powQuality?: string | null;
    refereeHashes?: unknown[];
    size?: string | null;
    timestamp?: string | null;
    transactions?: unknown[];
    transactionsRoot?: string | null;
    // Added from Conflux-rust v2.0.0
    posReference?: string | null;
  }

  // https://doc.confluxnetwork.org/docs/core/build/json-rpc/cfx-namespace#cfx_getstatus
  export interface cfx_getStatusResponse {
    bestHash?: string | null;
    blockNumber?: string | null;
    chainId?: string | null;
    networkId?: string | null;
    ethereumSpaceChainId?: string | null;
    epochNumber?: string | null;
    latestCheckpoint?: string | null;
    latestConfirmed?: string | null;
    latestFinalized?: string | null;
    latestState?: string | null;
    pendingTxNumber?: string | null;
  }
}
