export const EVM_RPC = {
  getTransactionByHash: 'eth_getTransactionByHash',
  getTransactionReceipt: 'eth_getTransactionReceipt',
  getBlockByHash: 'eth_getBlockByHash',
  getBlockByNumber: 'eth_getBlockByNumber',
  getTransactionCount: 'eth_getTransactionCount',
  sendRawTransaction: 'eth_sendRawTransaction',
} as const;

export const CFX_RPC = {
  getTransactionByHash: 'cfx_getTransactionByHash',
  getTransactionReceipt: 'cfx_getTransactionReceipt',
  getBlockByHash: 'cfx_getBlockByHash',
  getStatus: 'cfx_getStatus',
  getNextNonce: 'cfx_getNextNonce',
  sendRawTransaction: 'cfx_sendRawTransaction',
} as const;
