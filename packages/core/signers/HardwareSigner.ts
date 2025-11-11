import type { ChainType, ISigner } from '@core/types';
import type { BSIMPluginClass } from '@WalletCoreExtends/Plugins/BSIM';

interface HardwareSignerOptions {
  wallet: BSIMPluginClass;
  derivationPath: string;
  chainType: ChainType;
}

export class HardwareSigner implements ISigner {
  readonly type = 'hardware' as const;
  private readonly wallet: BSIMPluginClass;
  private readonly derivationPath: string;
  private readonly chainType: ChainType;

  constructor({ wallet, derivationPath, chainType }: HardwareSignerOptions) {
    if (!wallet) throw new Error('HardwareSigner requires a hardware wallet instance.');
    if (!derivationPath) throw new Error('HardwareSigner requires a derivation path.');
    this.wallet = wallet;
    this.derivationPath = derivationPath;
    this.chainType = chainType;
  }

  getChainType(): ChainType {
    return this.chainType;
  }

  getDerivationPath(): string {
    return this.derivationPath;
  }

  async sign(data: unknown): Promise<string> {
    throw new Error('Not implemented.');
  }
}
