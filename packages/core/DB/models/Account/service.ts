import { Q, type Query } from '@nozbe/watermelondb';
import { type Observable } from '@nozbe/watermelondb/utils/rx';
import { type Network } from '../Network';
import { type AccountGroup } from '../AccountGroup';
import { type Account } from './';
import { createAddress } from '../Address/service';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { createModel } from '../../helper/modelHelper';
import { fromPrivate } from '../../../utils/account';
import TableName from '../../TableName';
import database from '../../';

export async function createAccount({
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
    vault.type === 'hierarchical_deterministic' ? index ?? accountGroup.getLastIndex() : -1,
    vault.getData(),
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
        return vaultData;
      } else {
        let privateKey: string;
        if (vault.type === 'private_key') {
          privateKey = vaultData;
          return fromPrivate(privateKey).address
        } else {
          const hdPath = await network.hdPath;
          const ret = await getNthAccountOfHDKey({
            mnemonic: vaultData,
            hdPath: hdPath.value,
            nth: newAccountIndex,
          });
          return ret.hexAddress
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

export const querySelectedAccount = (_database: typeof database = database) =>
  _database.get(TableName.Account).query(Q.where('selected', true)) as unknown as Query<Account>;

export const observeAccountById = (_database: typeof database, id: string) => _database.get(TableName.Account).findAndObserve(id) as Observable<Account>;

export const selectAccount = async (targetAccount: Account) =>
  database.write(async () => {
    if (targetAccount.selected) return;
    const selectedAccount = await querySelectedAccount(database);
    const updates = selectedAccount
      .map((account) =>
        account.prepareUpdate((_account) => {
          _account.selected = false;
        })
      )
      .concat(
        targetAccount.prepareUpdate((_account) => {
          _account.selected = true;
        })
      );
    return database.batch(...updates);
  });
