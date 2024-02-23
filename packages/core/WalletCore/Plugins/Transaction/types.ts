export type HexStringType = `0x${string}`;

export type ITxEvm = {
  from: string;
  to: string;
  value: bigint;
  data?: string;

  nonce?: number;
  type?: number

//   gas?: string;
  gasLimit?: string;
  gasPrice?: string;
//   maxFeePerGas?: string;
//   maxPriorityFeePerGas?: string;
};

export enum IBSIMTxEventTypesName {
    ERROR = 'error',
    GET_NONCE = 'getNonce',
    BSIM_VERIFY_START = 'BSIMVerifyStart',
    BSIM_SIGN_START = 'BSIMSignStart',
    BSIM_TX_SEND = 'BSIMTxSend',
  }
  
  export interface IBSIMTxEvent {
    type: IBSIMTxEventTypesName;
    message?: string;
    error?: boolean;
    nonce?: string;
  }