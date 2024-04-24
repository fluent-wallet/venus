export enum BSIMEventTypesName {
  Cancel = 'cancel',
  ERROR = 'error',
  GET_NONCE = 'getNonce',

  BSIM_VERIFY_START = 'BSIMVerifyStart',
  BSIM_SIGN_START = 'BSIMSignStart',
  BSIM_TX_SEND = 'BSIMTxSend',
}

export interface BSIMEvent {
  type: BSIMEventTypesName;
  message?: string;
  error?: boolean;
  nonce?: string;
}
