export enum TxEventTypesName {
  ERROR = 'error',
  GET_NONCE = 'getNonce',

  BSIM_VERIFY_START = 'BSIMVerifyStart',
  BSIM_SIGN_START = 'BSIMSignStart',
  BSIM_TX_SEND = 'BSIMTxSend',
}

export interface TxEvent {
  type: TxEventTypesName;
  message?: string;
  error?: boolean;
  nonce?: string;
}
