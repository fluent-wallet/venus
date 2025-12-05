import type { ChainType, HardwareSignResult, IHardwareSigner, IHardwareWallet, SigningContext } from '@core/types';

interface HardwareSignerOptions {
  wallet: IHardwareWallet;
  derivationPath: string;
  chainType: ChainType;
}

export class HardwareSigner implements IHardwareSigner {
  readonly type = 'hardware' as const;
  private readonly wallet: IHardwareWallet;
  private readonly derivationPath: string;
  private readonly chainType: ChainType;

  constructor({ wallet, derivationPath, chainType }: HardwareSignerOptions) {
    if (!wallet) throw new Error('HardwareSigner requires wallet');
    if (!derivationPath) throw new Error('HardwareSigner requires derivation path');
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

  async signWithHardware(context: SigningContext): Promise<HardwareSignResult> {
    return this.wallet.sign(context);
  }
}
