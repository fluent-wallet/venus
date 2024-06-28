export enum SignType {
  // eth_signTransaction
  TX = 'tx',
  // personal_sign
  STR = 'string',
  // eth_signTypedData
  JSON = 'json',
}

export enum SignatureFilterOption {
  All = 'all',
  Message = 'message',
  Transactions = 'transactions',
}
