import { injectable, inject } from 'inversify';
import { Plugins } from '../Plugins';
import { type Network } from '../../database/models/Network';
import { type AccountGroup } from '../../database/models/AccountGroup';
import { type Account } from '../../database/models/Account';
import { type Vault } from '../../database/models/Vault';
import { type Address } from '../../database/models/Address';
import { createAddress } from '../../database/models/Address/query';
import { createModel } from '../../database/helper/modelHelper';
import VaultType from '../../database/models/Vault/VaultType';
import database from '../../database';
import TableName from '../../database/TableName';
import { getNthAccountOfHDKey } from '../../utils/hdkey';
import { fromPrivate, toChecksum } from '../../utils/account';

export interface Params {
  accountGroup: AccountGroup;
  nickname?: string;
  hidden?: boolean;
  selected?: boolean;
  hexAddress?: string;
  index?: number;
  vaultData?: string;
}

@injectable()
export class AddAccountMethod {
  @inject(Plugins) plugins!: Plugins;

  async addAccount(params: Params & { vault: Vault }, prepareCreate: true): Promise<(Account | Address)[]>;
  async addAccount(params: Params): Promise<Account>;
  async addAccount({ accountGroup, nickname, hidden, selected, hexAddress, index, vault, vaultData: _vaultData }: Params & { vault?: Vault }, prepareCreate?: true) {
    if (!accountGroup) throw new Error('AccountGroup is required in createAccount.');
    const _vault = vault ?? (await (await accountGroup).vault);
    const [networks, lastAccountIndex, vaultData] = await Promise.all([
      database.get<Network>(TableName.Network).query().fetch(),
      _vault.type === VaultType.HierarchicalDeterministic ? index ?? accountGroup.getLastAccountIndex() : -1,
      _vault.type === VaultType.PrivateKey || _vault.type === VaultType.HierarchicalDeterministic
        ? (_vaultData ?? this.plugins.CryptoTool.decrypt<string>(_vault.data!))
        : _vault.data,
    ]);
    const newAccountIndex = index ?? lastAccountIndex + 1;

    // For each network, an Account has its corresponding Address.
    // For vaults of type 'public_address' and 'hardware', the Address is the vault's data.
    // For vaults of type 'private_key', the needs to be generated from the privateKey.
    // For vaults of type 'hierarchical_deterministic', it's' necessary to first generate the privateKey from the mnemonic based on the index of the Account.
    const hexAddressesInNetwork = await Promise.all(
      networks.map(async (network) => {
        if (_vault.type === VaultType.Hardware || _vault.type === VaultType.BSIM) {
          return hexAddress!;
        } else if (_vault.type === VaultType.PublicAddress) {
          return vaultData!;
        } else {
          if (_vault.type === VaultType.PrivateKey) {
            return fromPrivate(vaultData!).address;
          } else {
            const hdPath = await network.hdPath;
            const ret = await getNthAccountOfHDKey({
              mnemonic: vaultData!,
              hdPath: hdPath.value,
              nth: newAccountIndex,
            });
            return ret.hexAddress;
          }
        }
      })
    );

    const newAccount = createModel({
      name: TableName.Account,
      params: {
        nickname: nickname ?? `Account - ${newAccountIndex + 1}`,
        index: newAccountIndex,
        hidden: hidden ?? false,
        selected: selected ?? false,
        accountGroup,
      },
      prepareCreate: true,
    }) as Account;

    const defaultAssetRules = await Promise.all(networks.map((network) => network.defaultAssetRule));
    const addresses = hexAddressesInNetwork.map((hexAddress, index) =>
      createAddress({ network: networks[index], assetRule: defaultAssetRules[index], account: newAccount, hex: toChecksum(hexAddress) }, true)
    );

    if (prepareCreate) {
      return [newAccount, ...addresses];
    }

    return database.write(async () => {
      await database.batch(newAccount, ...addresses);
      return newAccount;
    });
  }
}
