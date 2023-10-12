import { Mnemonic, randomBytes } from '@setup/ethers';

export const generateMnemonic = () => Mnemonic.fromEntropy(randomBytes(16));
