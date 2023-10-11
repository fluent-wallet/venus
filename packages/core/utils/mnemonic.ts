import { Mnemonic, randomBytes } from 'ethers';

export const generateMnemonic = () => Mnemonic.fromEntropy(randomBytes(16));
