import { createWallet, type Wallet } from './wallet';

let instance: Wallet | undefined;

export const getWallet = (): Wallet => {
  if (!instance) {
    instance = createWallet({logger: console.log});
  }
  return instance;
};
