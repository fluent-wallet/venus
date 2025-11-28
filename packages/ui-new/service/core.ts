import type { Container } from 'inversify';
import { container as coreContainer } from '@core/WalletCore/configs';
import {
  AccountService,
  NetworkService,
  AssetService,
  TransactionService,
  VaultService,
  type IAccount,
  type INetwork,
  type IAsset,
  type ITransaction,
} from '@core/services';
import { QueryClient } from '@tanstack/react-query';

let uiServiceContainer: Container | null = null;
let uiQueryClient: QueryClient | null = null;

export type { IAccount, INetwork, IAsset, ITransaction };

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
