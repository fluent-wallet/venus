import { CORE_IDENTIFIERS } from '@core/di';
import { AssetsSyncService } from '@core/modules/assetsSync';
import type { AuthService } from '@core/modules/auth';
import type { CoreEventMap } from '@core/modules/eventBus';
import type { ExternalRequestsService } from '@core/modules/externalRequests';
import type { RuntimeConfig } from '@core/runtime/types';
import {
  AccountService,
  AddressValidationService,
  AssetService,
  type IAccount,
  type IAsset,
  type INetwork,
  type ITransaction,
  type IVault,
  NetworkService,
  type RecentlyAddress,
  SignatureRecordService,
  TransactionService,
  VaultService,
} from '@core/services';
import { HardwareWalletService } from '@core/services/hardware/HardwareWalletService';
import { container as coreContainer } from '@core/WalletCore/configs';
import type { EventBus } from '@core/WalletCore/Events/eventTypes';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { QueryClient } from '@tanstack/react-query';
import type { Container } from 'inversify';

let uiServiceContainer: Container | null = null;
let uiQueryClient: QueryClient | null = null;

export type { IAccount, INetwork, IAsset, ITransaction, IVault, RecentlyAddress };

export function setUiServiceContainer(container: Container) {
  uiServiceContainer = container;
}

export function setUiQueryClient(client: QueryClient) {
  uiQueryClient = client;
}

function getContainer(): Container {
  return uiServiceContainer ?? coreContainer;
}

const defaultQueryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export function getQueryClient(): QueryClient {
  return uiQueryClient ?? defaultQueryClient;
}

export function getAccountService(): AccountService {
  return getContainer().get(AccountService);
}

export function getAddressValidationService(): AddressValidationService {
  return getContainer().get(AddressValidationService);
}

export function getNetworkService(): NetworkService {
  return getContainer().get(NetworkService);
}

export function getAssetService(): AssetService {
  return getContainer().get(AssetService);
}

export function getTransactionService(): TransactionService {
  return getContainer().get(TransactionService);
}

export function getAssetsSyncService(): AssetsSyncService {
  return getContainer().get(AssetsSyncService);
}

export function getVaultService(): VaultService {
  return getContainer().get(VaultService);
}

export function getHardwareWalletService(): HardwareWalletService {
  return getContainer().get(HardwareWalletService);
}

export function getSignatureRecordService(): SignatureRecordService {
  return getContainer().get(SignatureRecordService);
}

export function getAuthService(): AuthService {
  return getContainer().get<AuthService>(CORE_IDENTIFIERS.AUTH);
}

export function getExternalRequestsService(): ExternalRequestsService {
  return getContainer().get<ExternalRequestsService>(CORE_IDENTIFIERS.EXTERNAL_REQUESTS);
}

export function getRuntimeConfig(): RuntimeConfig {
  return getContainer().get<RuntimeConfig>(CORE_IDENTIFIERS.CONFIG);
}

export function getRuntimeEventBus(): import('@core/modules/eventBus').EventBus<CoreEventMap> {
  return getContainer().get<import('@core/modules/eventBus').EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
}

export function getLegacyEventBus(): EventBus {
  return coreContainer.get<EventBus>(SERVICE_IDENTIFIER.EVENT_BUS);
}

export function getEventBus(): import('@core/modules/eventBus').EventBus<CoreEventMap> {
  return getRuntimeEventBus();
}
