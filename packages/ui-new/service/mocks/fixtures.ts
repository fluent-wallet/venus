import { AssetSource } from '@core/database/models/Asset';
import { ChainType, NetworkType } from '@core/database/models/Network';
import VaultType from '@core/database/models/Vault/VaultType';
import { AssetType, TxStatus } from '@core/types';
import type { IAccount, IAsset, INetwork, ITransaction, IVault, RecentlyAddress } from '../core';

export const mockAccount: IAccount = {
  id: 'acc_1',
  nickname: 'Main',
  address: '0xabc',
  balance: '0',
  formattedBalance: '0',
  isHardwareWallet: false,
  vaultType: VaultType.HierarchicalDeterministic,
  accountGroupId: 'group_1',
  index: 0,
  hidden: false,
  selected: true,
  currentAddressId: 'addr_1',
};

export const mockAsset: IAsset = {
  name: 'test',
  contractAddress: '0x123',
  icon: '',
  source: AssetSource.Custom,
  id: 'asset_1',
  symbol: 'CFX',
  decimals: 18,
  balance: '100',
  priceValue: '2',
  type: AssetType.ERC20,
  formattedBalance: '0',
  priceInUSDT: '0',
  networkId: '1',
  assetRuleId: '1',
};

export const mockNetwork: INetwork = {
  id: 'net_1',
  name: 'Conflux eSpace',
  endpoint: 'https://rpc.test',
  endpointsList: [],
  netId: 1,
  chainId: '1030',
  gasBuffer: 1.1,
  networkType: NetworkType.Conflux,
  chainType: ChainType.Testnet,
  icon: null,
  scanUrl: null,
  selected: true,
  builtin: true,
};

export const mockVault: IVault = {
  id: 'vault_1',
  type: VaultType.HierarchicalDeterministic,
  device: 'Device',
  isBackup: true,
  source: 'create' as never,
  isGroup: false,
  accountGroupId: 'group_1',
};

export const mockTransaction: ITransaction = {
  id: 'tx_1',
  hash: '0xhash',
  from: '0xaaa',
  to: '0xbbb',
  value: '1',
  status: TxStatus.Pending,
  timestamp: 1_700_000_000_000,
  networkId: 'net_1',
};

export const mockRecentlyAddress: RecentlyAddress = {
  addressValue: '0xccc',
  direction: 'inbound',
  isLocalAccount: true,
  lastUsedAt: 1_700_000_100_000,
};
