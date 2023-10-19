import { type Network } from '@core/DB/models/Network';
import TableName from '@core/DB/TableName';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { createModel } from '@core/DB/helper/modelHelper';
import { createAddress } from '@core/DB/models/Address';
import { fromPrivate } from '@core/utils/account';
import { type AccountGroup } from '@core/DB/models/AccountGroup';
import { Account } from '@core/DB/models/Account';
import database from '@core/DB';

export async function createAccount({
  accountGroup,
  nickname,
  hidden,
  selected,
}: {
  accountGroup: AccountGroup;
  nickname?: string;
  hidden?: boolean;
  selected?: boolean;
}) {
  if (!accountGroup) throw new Error('AccountGroup is required in createAccount.');
  const vault = await (await accountGroup).vault;

  const [networks, newAccountIndex, vaultData] = await Promise.all([
    database.get<Network>(TableName.Network).query().fetch(),
    vault.type === 'hierarchical_deterministic' ? accountGroup.account.count : 0,
    vault.getData(),
  ]);

  // For each network, an Account has its corresponding Address.
  // For vaults of type 'public_address' and 'hardware', the Address is the vault's data.
  // For vaults of type 'private_key', the needs to be generated from the privateKey.
  // For vaults of type 'hierarchical_deterministic', it's' necessary to first generate the privateKey from the mnemonic based on the index of the Account.
  const networksWithHexAddress = await Promise.all(
    networks.map(async (network) => {
      if (vault.type === 'public_address' || vault.type === 'hardware') {
        return vaultData;
      } else {
        let privateKey: string;
        if (vault.type === 'private_key') {
          privateKey = vaultData;
        } else {
          const hdPath = await network.hdPath;
          const ret = await getNthAccountOfHDKey({
            mnemonic: vaultData,
            hdPath: hdPath.value,
            nth: newAccountIndex,
          });
          privateKey = ret.privateKey;
        }
        return fromPrivate(privateKey).address;
      }
    })
  );

  const newAccount = createModel({
    name: TableName.Account,
    params: {
      nickname: nickname ?? `${accountGroup.nickname}-${newAccountIndex}`,
      index: newAccountIndex,
      hidden: hidden ?? false,
      selected: selected ?? false,
      accountGroup,
    },
    prepareCreate: true,
  }) as Account;

  const addresses = networksWithHexAddress.map((hexAddress, index) => createAddress({ network: networks[index], hex: hexAddress, account: newAccount }, true));
  await database.batch(newAccount, ...addresses);
  return newAccount;
}