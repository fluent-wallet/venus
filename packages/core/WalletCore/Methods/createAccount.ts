import { inject } from 'inversify';
import { Plugins, PluginsSymbol } from '../plugins';
import { type Network } from '../../database/models/Network';
import { type AccountGroup } from '../../database/models/AccountGroup';
import { type Account } from '../../database/models/Account';
import { createAddress } from '../../database/models/Address/query';
import { createModel } from '../../database/helper/modelHelper';
import database from '../../database';
import TableName from '../../database/TableName';
import { getNthAccountOfHDKey } from '../../utils/hdkey';
import { fromPrivate } from '../../utils/account';


export class createAccountMethod  {
  @inject(PluginsSymbol) plugins!: Plugins;
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

    const [networks, lastAccountIndex] = await Promise.all([
      database.get<Network>(TableName.Network).query().fetch(),
      vault.type === 'hierarchical_deterministic' ? index ?? accountGroup.getLastAccountIndex() : -1,
    ]);
    const newAccountIndex = index ?? lastAccountIndex + 1;

    // For each network, an Account has its corresponding Address.
    // For vaults of type 'public_address' and 'hardware', the Address is the vault's data.
    // For vaults of type 'private_key', the needs to be generated from the privateKey.
    // For vaults of type 'hierarchical_deterministic', it's' necessary to first generate the privateKey from the mnemonic based on the index of the Account.
    const networksWithHexAddress = await Promise.all(
      networks.map(async (network) => {
        if (vault.type === 'hardware' || vault.type === 'BSIM') {
          return hexAddress!;
        } else if (vault.type === 'public_address') {
          return vaultData!;
        } else {
          let privateKey: string;
          if (vault.type === 'private_key') {
            privateKey = vaultData!;
            return fromPrivate(privateKey).address;
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

      const addresses = networksWithHexAddress.map((hexAddress, index) =>
        createAddress({ network: networks[index], hex: hexAddress, account: newAccount }, true)
      );
      await database.batch(newAccount, ...addresses);
      return newAccount;
    });
  }
}
