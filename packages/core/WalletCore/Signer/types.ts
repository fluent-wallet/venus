export enum ChainFamily {
  EVM = 'evm',
  CFX = 'cfx',
}

export interface Signer {
  getAddress(chain: ChainFamily): Promise<string>;

  // TODO update this type
  signMessageHash(messageHash: Uint8Array, chain: ChainFamily): Promise<any>;

  // TODO update this type
  signTransaction(tx: any, chain: ChainFamily): Promise<any>;
}
