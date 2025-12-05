import type { HardwareWalletCapabilities, IHardwareWallet } from '@core/types';
import { injectable } from 'inversify';

type RegistryEntry = {
  adapter: IHardwareWallet;
  hardwareId?: string;
};

@injectable()
export class HardwareWalletRegistry {
  private readonly adapters = new Map<string, RegistryEntry>();

  get size(): number {
    return this.adapters.size;
  }

  register(type: string, hardwareId: string | undefined, adapter: IHardwareWallet): this {
    const key = this.toKey(type);
    if (this.adapters.has(key)) {
      throw new Error(`[HardwareWalletRegistry] Adapter already registered for type ${type}`);
    }
    this.adapters.set(key, { adapter, hardwareId });
    return this;
  }

  get(type: string, hardwareId?: string): IHardwareWallet | undefined {
    const entry = this.adapters.get(this.toKey(type));
    if (!entry) return undefined;
    if (hardwareId && entry.hardwareId && entry.hardwareId !== hardwareId) {
      return undefined;
    }
    return entry.adapter;
  }

  has(type: string, hardwareId?: string): boolean {
    return this.get(type, hardwareId) !== undefined;
  }

  list(): Array<{ type: string; hardwareId?: string; capabilities: HardwareWalletCapabilities }> {
    return [...this.adapters.entries()].map(([type, entry]) => ({
      type,
      hardwareId: entry.hardwareId,
      capabilities: entry.adapter.getCapabilities(),
    }));
  }

  private toKey(type: string): string {
    return type.toLowerCase();
  }
}
