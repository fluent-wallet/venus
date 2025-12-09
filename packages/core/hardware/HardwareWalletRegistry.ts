import type { HardwareWalletCapabilities, IHardwareWallet } from '@core/types';
import { injectable } from 'inversify';

@injectable()
export class HardwareWalletRegistry {
  private readonly adapters = new Map<string, Map<string | undefined, IHardwareWallet>>();

  get size(): number {
    let total = 0;
    for (const bucket of this.adapters.values()) {
      total += bucket.size;
    }
    return total;
  }

  register(type: string, hardwareId: string | undefined, adapter: IHardwareWallet): this {
    const bucket = this.ensureBucket(type);
    if (bucket.has(hardwareId)) {
      throw new Error(`[HardwareWalletRegistry] Adapter already registered for type ${type} (hardwareId=${hardwareId ?? '<default>'})`);
    }
    bucket.set(hardwareId, adapter);
    return this;
  }

  get(type: string, hardwareId?: string): IHardwareWallet | undefined {
    return this.adapters.get(this.toKey(type))?.get(hardwareId);
  }

  has(type: string, hardwareId?: string): boolean {
    return this.get(type, hardwareId) !== undefined;
  }

  list(): Array<{ type: string; hardwareId?: string; capabilities: HardwareWalletCapabilities }> {
    const result: Array<{ type: string; hardwareId?: string; capabilities: HardwareWalletCapabilities }> = [];
    for (const [type, bucket] of this.adapters.entries()) {
      for (const [hardwareId, adapter] of bucket.entries()) {
        result.push({ type, hardwareId, capabilities: adapter.getCapabilities() });
      }
    }
    return result;
  }

  private ensureBucket(type: string): Map<string | undefined, IHardwareWallet> {
    const key = this.toKey(type);
    const bucket = this.adapters.get(key);
    if (bucket) return bucket;
    const created = new Map<string | undefined, IHardwareWallet>();
    this.adapters.set(key, created);
    return created;
  }

  private toKey(type: string): string {
    return type.toLowerCase();
  }
}
