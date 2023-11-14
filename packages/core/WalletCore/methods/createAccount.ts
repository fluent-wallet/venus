import { injectable, inject } from 'inversify';
import { Plugins } from '../plugins';
import { type Network } from '../../database/models/Network';
import { type AccountGroup } from '../../database/models/AccountGroup';
import { type Account } from '../../database/models/Account';
import { createAddress } from '../../database/models/Address/query';
import { createModel } from '../../database/helper/modelHelper';
import database from '../../database';
import TableName from '../../database/TableName';
import { getNthAccountOfHDKey } from '../../utils/hdkey';
import { fromPrivate } from '../../utils/account';

@injectable()
export class CreateAccountMethod {
  @inject(Plugins) plugins!: Plugins;

  async createAccount({
    accountGroup,
    nickname,
    hidden,
    selected,
    hexAddress,
    index,
  }: {
    accountGroup: AccountGroup;
    nickname?: string;
    hidden?: boolean;
    selected?: boolean;
    hexAddress?: string;
    index?: number;
  }) {
    if (!accountGroup) throw new Error('AccountGroup is required in createAccount.');
    const vault = await (await accountGroup).vault;

    const [networks, lastAccountIndex, vaultData] = await Promise.all([
      database.get<Network>(TableName.Network).query().fetch(),
      vault.type === 'hierarchical_deterministic' ? index ?? accountGroup.getLastAccountIndex() : -1,
      vault.type === 'private_key' || vault.type === 'hierarchical_deterministic' ? this.plugins.CryptoTool.decrypt<string>(vault.data!) : vault.data,
    ]);
    const newAccountIndex = index ?? lastAccountIndex + 1;

    // For each network, an Account has its corresponding Address.
    // For vaults of type 'public_address' and 'hardware', the Address is the vault's data.
    // For vaults of type 'private_key', the needs to be generated from the privateKey.
    // For vaults of type 'hierarchical_deterministic', it's' necessary to first generate the privateKey from the mnemonic based on the index of the Account.
    const hexAddressesInNetwork = await Promise.all(
      networks.map(async (network) => {
        if (vault.type === 'hardware' || vault.type === 'BSIM') {
          return hexAddress!;
        } else if (vault.type === 'public_address') {
          return vaultData!;
        } else {
          if (vault.type === 'private_key') {
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

    return database.write(async () => {
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

      const addresses = hexAddressesInNetwork.map((hexAddress, index) =>
        createAddress({ network: networks[index], hex: hexAddress, account: newAccount }, true)
      );
      await database.batch(newAccount, ...addresses);
      return newAccount;
    });
  }
}
