import type { ISigner } from '@core/types';

export class SoftwareSigner implements ISigner {
  readonly type = 'software' as const;

  constructor(private readonly privateKey: string) {
    if (!privateKey) {
      throw new Error('SoftwareSigner requires a private key.');
    }
  }
  getPrivateKey(): string {
    return this.privateKey;
  }

  async sign(data: unknown): Promise<string> {
    throw new Error('Not implemented');
  }
}
