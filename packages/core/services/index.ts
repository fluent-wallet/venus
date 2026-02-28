export * from './account';
export * from './address';
export * from './asset';
export * from './network';
export * from './nft';
export * from './signing';
export { SignatureRecordService } from './signing/SignatureRecordService';
export * from './transaction';
export * from './vault';

import { ChainRegistry } from '@core/chains';
import { EndpointManager } from '@core/chains/EndpointManager';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import type { Container } from 'inversify';
import { AccountService } from './account';
import { AddressValidationService } from './address/AddressValidationService';
import { AssetService } from './asset';
import { ChainStatusService } from './chain/ChainStatusService';
import { HardwareWalletService } from './hardware/HardwareWalletService';
import { NetworkService } from './network';
import { NftService } from './nft/NftService';
import { SigningService } from './signing';
import { SignatureRecordService } from './signing/SignatureRecordService';
import { TransactionService } from './transaction';
import { VaultService } from './vault';

export { AddressValidationService } from './address/AddressValidationService';
export { ChainStatusService } from './chain/ChainStatusService';

export { HardwareWalletService } from './hardware/HardwareWalletService';

export function registerServices(target: Container): void {
  target.bind(ChainRegistry).toSelf().inSingletonScope();
  target.bind(EndpointManager).toSelf().inSingletonScope();
  target.bind(ChainStatusService).toSelf().inSingletonScope();
  target.bind(AddressValidationService).toSelf().inSingletonScope();
  target.bind(VaultService).toSelf().inSingletonScope();
  target.bind(AccountService).toSelf().inSingletonScope();
  target.bind(AssetService).toSelf().inSingletonScope();
  target.bind(NftService).toSelf().inSingletonScope();
  target.bind(SigningService).toSelf().inSingletonScope();
  target.bind(SignatureRecordService).toSelf().inSingletonScope();
  target.bind(TransactionService).toSelf().inSingletonScope();
  target.bind(NetworkService).toSelf().inSingletonScope();
  target.bind(HardwareWalletService).toSelf().inSingletonScope();
  target.bind(HardwareWalletRegistry).toSelf().inSingletonScope();
}
