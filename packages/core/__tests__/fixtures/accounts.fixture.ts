import type { Database } from '@nozbe/watermelondb';

import TableName from '@core/database/TableName';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { AssetRule } from '@core/database/models/AssetRule';
import type { HdPath } from '@core/database/models/HdPath';
import type { Network } from '@core/database/models/Network';
import type { Vault } from '@core/database/models/Vault';
import VaultSourceType from '@core/database/models/Vault/VaultSourceType';
import VaultType from '@core/database/models/Vault/VaultType';
import { NetworkType, Networks } from '@core/utils/consts';

export const DEFAULT_ACCOUNTS_FIXTURE_BASE32 = 'cfx:aap7rugsfdnj0dyy3f8766mme2dhf62136u8gkm4fg';
export const DEFAULT_ACCOUNTS_FIXTURE_HEX = '0x19D6c0CE28d68B0e94C97Dde714a260672f317cF'; // 64ce5801197a5e99e4f378a8cf5454f323b4b4553e16a5b7d75567991feee4df

type NetworkDefinitionKey = keyof typeof Networks;

export interface SeedNetworkOptions {
  definitionKey?: NetworkDefinitionKey;
  selected?: boolean;
}

export interface SeedNetworkResult {
  network: Network;
  assetRule: AssetRule;
}

export interface CreateTestAccountOptions {
  nickname?: string;
  selected?: boolean;
  hidden?: boolean;
  index?: number;
  base32?: string;
  hex?: string;
  vaultType?: VaultType;
  vaultDevice?: 'ePayWallet' | 'FluentWebExt';
  vaultSource?: VaultSourceType;
  network?: Network;
  assetRule?: AssetRule;
  accountGroupNickname?: string;
}

export interface CreateTestAccountResult {
  account: Account;
  accountGroup: AccountGroup;
  address: Address;
  vault: Vault;
  network: Network;
  assetRule: AssetRule;
}

const resolveHdPathValue = (networkType: NetworkType) => (networkType === NetworkType.Conflux ? "m/44'/503'/0'/0" : "m/44'/60'/0'/0");

export const seedNetwork = async (db: Database, options: SeedNetworkOptions = {}): Promise<SeedNetworkResult> => {
  const { definitionKey = 'Conflux Testnet', selected } = options;
  const definition = Networks[definitionKey];

  if (!definition) {
    throw new Error(`Unknown network definition: ${definitionKey}`);
  }

  let network: Network;
  let assetRule: AssetRule;

  await db.write(async () => {
    const hdPath = await db.get<HdPath>(TableName.HdPath).create((record) => {
      record.name = `${definition.name} HD Path`;
      record.value = resolveHdPathValue(definition.networkType);
    });

    network = await db.get<Network>(TableName.Network).create((record) => {
      record.name = definition.name;
      record.endpoint = definition.endpoint;
      record.netId = definition.netId;
      record.chainId = definition.chainId;
      record.gasBuffer = definition.gasBuffer ?? 1;
      record.networkType = definition.networkType;
      record.chainType = definition.chainType;
      record.icon = definition.icon ?? null;
      record.scanUrl = definition.scanUrl ?? null;
      record.selected = selected ?? Boolean(definition.selected);
      record.builtin = definition.builtin ?? true;
      record.endpointsList = [];
      record.hdPath.set(hdPath);
    });

    assetRule = await db.get<AssetRule>(TableName.AssetRule).create((record) => {
      record.name = `${definition.name} Default Rule`;
      record.index = 0;
      record.network.set(network);
    });
  });

  return { network: network!, assetRule: assetRule! };
};

export const createTestAccount = async (db: Database, options: CreateTestAccountOptions = {}): Promise<CreateTestAccountResult> => {
  const {
    nickname = 'Account',
    selected = true,
    hidden = false,
    index,
    base32 = DEFAULT_ACCOUNTS_FIXTURE_BASE32,
    hex = DEFAULT_ACCOUNTS_FIXTURE_HEX,
    vaultType = VaultType.HierarchicalDeterministic,
    vaultDevice = 'ePayWallet',
    vaultSource = VaultSourceType.CREATE_BY_WALLET,
    network: providedNetwork,
    assetRule: providedAssetRule,
    accountGroupNickname = 'Group',
  } = options;

  let network = providedNetwork;
  let assetRule = providedAssetRule;

  if (!network || !assetRule) {
    const seeded = await seedNetwork(db);
    network = network ?? seeded.network;
    assetRule = assetRule ?? seeded.assetRule;
  }

  const existingAccounts = await db.get<Account>(TableName.Account).query().fetch();
  const nextIndex = index ?? existingAccounts.length;

  let account: Account;
  let accountGroup: AccountGroup;
  let address: Address;
  let vault: Vault;

  await db.write(async () => {
    vault = await db.get<Vault>(TableName.Vault).create((record) => {
      record.type = vaultType;
      record.data = vaultType === VaultType.PublicAddress ? null : 'encrypted-seed';
      record.device = vaultDevice;
      record.cfxOnly = false;
      record.isBackup = false;
      record.source = vaultSource;
    });

    accountGroup = await db.get<AccountGroup>(TableName.AccountGroup).create((record) => {
      record.nickname = accountGroupNickname;
      record.hidden = false;
      record.vault.set(vault);
    });

    account = await db.get<Account>(TableName.Account).create((record) => {
      record.nickname = nickname;
      record.index = nextIndex;
      record.hidden = hidden;
      record.selected = selected;
      record.accountGroup.set(accountGroup);
    });

    address = await db.get<Address>(TableName.Address).create((record) => {
      record.account.set(account);
      record.network.set(network!);
      record.assetRule.set(assetRule!);
      record.base32 = base32;
      record.hex = hex;
    });
  });

  return {
    account: account!,
    accountGroup: accountGroup!,
    address: address!,
    vault: vault!,
    network: network!,
    assetRule: assetRule!,
  };
};
