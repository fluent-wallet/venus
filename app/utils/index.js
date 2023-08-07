import database from '../Database';
import Encrypt from './encrypt';
import {ABI_777, ABI_721, ABI_1155, CHECK_ABI} from '../Consts/tokenAbi';
import {Interface} from '@ethersproject/abi';
import {getNthAccountOfHDKey} from '@fluent-wallet/hdkey';
import {encode} from '@fluent-wallet/base32-address';
import {toAccountAddress} from '@fluent-wallet/account';

const encrypt = new Encrypt();

export const iface777 = new Interface(ABI_777);
export const iface721 = new Interface(ABI_721);
export const iface1155 = new Interface(ABI_1155);
export const ifaceChecker = new Interface(CHECK_ABI);
export const camelCase = str => {
  return str.replace(/_([a-z])/g, function (match, group1) {
    return group1.toUpperCase();
  });
};

export const validateDuplicateVault = async (password, data) => {
  const records = await database.get('vault').query().fetch();
  let ret = false;
  if (records.length) {
    for (let i = 0; i < records.length; i++) {
      let {data: decryptData} = await encrypt.decrypt(
        password,
        records[i].data,
      );
      if (decryptData === data) {
        ret = true;
        break;
      }
    }
  }
  return ret;
};

export const isHexAddress = address => /^0x[0-9a-fA-F]{40}$/.test(address);

export const enrichFetch = ({url, params, method = 'POST', headers = {}}) => {
  const options = {
    method,
    timeout: 6000,
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
  return fetch(url, {...options})
    .then(r => r.json())
    .then(r => {
      return r?.result || r;
    });
};

export const generateAddressesByMnemonic = ({
  networksArr,
  nth = 0,
  mnemonic,
  password,
}) => {
  return networksArr.map(async ({hdPath}) => {
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
}) => {
  return database.get('account').prepareCreate(r => {
    r.accountGroup.set(accountGroup);
    r.index = accountIndex;
    r.nickname = `${groupName}-${accountIndex}`;
    r.hidden = hidden;
    r.selected = selected;
  });
};

export const preCreateAddress = ({
  account,
  network,
  hex,
  pk,
  nativeBalance = '0x0',
}) => {
  return database.get('address').prepareCreate(r => {
    r.account.set(account);
    r.network.set(network);
    r.value =
      network.networkType === 'cfx'
        ? encode(toAccountAddress(hex), network.netId)
        : hex;
    r.hex = hex;
    r.pk = pk;
    r.native_balance = nativeBalance;
  });
};
