import type { Container } from 'inversify';
import { BSIMHardwareWallet } from './bsim';
import { HardwareWalletRegistry } from './HardwareWalletRegistry';

export interface RegisterHardwareWalletsOptions {
  container: Container;
  registerBSIM?: boolean;
  bsimFactory?: () => BSIMHardwareWallet;
}

export function registerDefaultHardwareWallets(options: RegisterHardwareWalletsOptions): void {
  const target = options.container;
  const includeBSIM = options.registerBSIM ?? true;

  if (!includeBSIM) return;

  const registry = target.get(HardwareWalletRegistry);
  if (registry.has('BSIM')) {
    return;
  }

  const adapter = options.bsimFactory?.() ?? new BSIMHardwareWallet();
  registry.register('BSIM', undefined, adapter);
}
