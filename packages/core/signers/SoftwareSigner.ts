import type { ISoftwareSigner } from '@core/types';

export class SoftwareSigner implements ISoftwareSigner {
  readonly type = 'software' as const;

  constructor(private readonly privateKey: string) {
    if (!privateKey) {
      throw new Error('SoftwareSigner requires a private key.');
    }
  }

  getPrivateKey(): string {
    return this.privateKey;
  }
}
