export * from './account';
export * from './asset';
export * from './network';
export * from './signing';
export * from './transaction';
export * from './vault';

import type { Container } from 'inversify';
import { container as defaultContainer } from '@core/WalletCore/configs';

import { VaultService } from './vault';
import { AccountService } from './account';
import { AssetService } from './asset';
import { SigningService } from './signing';
import { TransactionService } from './transaction';
import { NetworkService } from './network';

export function registerServices(target: Container = defaultContainer): void {
  target.bind(VaultService).toSelf().inSingletonScope();
  target.bind(AccountService).toSelf().inSingletonScope();
  target.bind(AssetService).toSelf().inSingletonScope();
  target.bind(SigningService).toSelf().inSingletonScope();
  target.bind(TransactionService).toSelf().inSingletonScope();
  target.bind(NetworkService).toSelf().inSingletonScope();
}
