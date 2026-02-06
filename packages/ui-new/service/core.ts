import {
  AccountService,
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

export function getNetworkService(): NetworkService {
  return getContainer().get(NetworkService);
}

export function getAssetService(): AssetService {
  return getContainer().get(AssetService);
}

export function getTransactionService(): TransactionService {
  return getContainer().get(TransactionService);
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

export function getEventBus(): EventBus {
  return getContainer().get<EventBus>(SERVICE_IDENTIFIER.EVENT_BUS);
}
