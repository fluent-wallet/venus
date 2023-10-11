import database, { Vault, Network, Account, AccountGroup, Address, TableName } from '../Database';
import { cryptoTool } from '../DB/helper/cryptoTool';
import { ABI_777, ABI_721, ABI_1155 } from '../Consts/tokenAbi';
import { Interface } from '@ethersproject/abi';
import { getNthAccountOfHDKey } from '@fluent-wallet/hdkey';
import { encode } from '@fluent-wallet/base32-address';
import { toAccountAddress } from '@fluent-wallet/account';

export const iface777 = new Interface(ABI_777);
export const iface721 = new Interface(ABI_721);
export const iface1155 = new Interface(ABI_1155);
export const camelCase = (str: string) => {
  return str.replace(/_([a-z])/g, function (_, group1) {
    return group1.toUpperCase();
  });
};

export const validateDuplicateVault = async (password: string, data: string) => {
  const records = (await database.get(TableName.Vault).query().fetch()) as Array<Vault>;

  let ret = false;
  if (records.length) {
    for (let i = 0; i < records.length; i++) {
      const { data: decryptData } = (await cryptoTool.decrypt(password, records[i].data)) as { data: string };
      if (decryptData === data) {
        ret = true;
        break;
      }
    }
  }
  return ret;
};

export const isHexAddress = (address: string) => /^0x[0-9a-fA-F]{40}$/.test(address);

export const enrichFetch = ({ url, params, method = 'POST', headers = {} }: RequestInit & { url: string; params: Record<string, string> }) => {
  const options: RequestInit = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (params) {
    options.body = JSON.stringify({
      ...params,
    });
  }
  return fetch(url, { ...options })
    .then((r) => r.json())
    .then((r) => {
      return r?.result || r;
    });
};

export const generateAddressesByMnemonic = ({
  networksArr,
  nth = 0,
  mnemonic,
  password,
}: {
  networksArr: Array<Network>;
  nth: number;
  mnemonic: string;
  password: string;
}) => {
  return networksArr.map(async ({ hdPath }) => {
    const hdPathRecord = await hdPath.fetch();
    const ret = await getNthAccountOfHDKey({
      mnemonic,
      hdPath: hdPathRecord.value,
      nth,
    });
    ret.encryptPk = await encrypt.encrypt(password, {
      pk: ret.privateKey,
    });
    // console.log('ret', ret);
    return ret;
  });
};

export const preCreateAccount = ({
  accountGroup,
  groupName,
  accountIndex,
  hidden = false,
  selected = false,
}: {
  accountGroup: AccountGroup;
  groupName: string;
  accountIndex: number;
  hidden: boolean;
  selected: false;
}) => {
  return database.get(TableName.Account).prepareCreate((r) => {
    const newAccount = r as Account;
    newAccount.accountGroup.set(accountGroup);
    newAccount.index = accountIndex;
    newAccount.nickname = `${groupName}-${accountIndex}`;
    newAccount.hidden = hidden;
    newAccount.selected = selected;
  });
};

export const preCreateAddress = ({
  account,
  network,
  hex,
  pk,
  nativeBalance = '0x0',
}: Omit<Address, 'account' | 'network'> & { network: Network; account: Account }) => {
  return database.get(TableName.Address).prepareCreate((r) => {
    const newAddress = r as Address;
    newAddress.account.set(account);
    newAddress.network.set(network);
    newAddress.value = network.networkType === 'cfx' ? encode(toAccountAddress(hex), network.netId) : hex;
    newAddress.hex = hex;
    newAddress.pk = pk;
    newAddress.nativeBalance = nativeBalance;
  });
};
