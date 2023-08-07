import {
  encode,
  decode,
  validateBase32Address,
} from '@fluent-wallet/base32-address';
import {hexValue} from '@ethersproject/bytes';
import {iface777, ifaceChecker} from '../utils';

import initSend from '../utils/send';

const ADDR_TYPE_TO_PREFIX = {
  user: '0x1',
  contract: '0x8',
  null: '0x0',
  builtin: '0x0',
};

const formatCfxAddress = ({address, networkId, addressType = 'user'}) => {
  if (validateBase32Address(address, networkId, addressType)) {
    return address;
  }

  if (address.includes(':')) {
    if (addressType && !validateBase32Address(address, addressType)) {
      throw Error('Invalid base32 address, address type is invalid');
    }
    return encode(decode(address).hexAddress, networkId);
  }

  if (!addressType) {
    addressType = 'user';
  }

  return encode(
    address.toLowerCase().replace(/0x./, ADDR_TYPE_TO_PREFIX[addressType]),
    networkId,
  );
};

class Balance {
  constructor({endpoint, networkType, networkId}) {
    this.isCfx = networkType === 'cfx';
    this.networkId = networkId;
    this.send = initSend(endpoint);
    this.params = this.isCfx ? 'latest_state' : 'latest';
    this.callMethod = this.isCfx ? 'cfx_call' : 'eth_call';
    this.getBalanceMethod = this.isCfx ? 'cfx_getBalance' : 'eth_getBalance';
  }
  async getNativeBalance(address) {
    const ret = await this.send(this.getBalanceMethod, [
      this.isCfx
        ? formatCfxAddress({address, networkId: this.networkId})
        : address,
      this.params,
    ]);
    // console.log('ret', ret);
    return ret;
  }
  async getTokenBalance({userAddress, tokenAddress}) {
    const user = this.isCfx ? decode(userAddress).hexAddress : userAddress;
    const data = iface777.encodeFunctionData('balanceOf', [user]);
    const ret = await this.send(this.callMethod, [
      {from: userAddress, to: tokenAddress, data},
      this.params,
    ]).then(r => iface777.decodeFunctionResult('balanceOf', r));
    // console.log('ret', ret);
    return ret;
  }
  // get token balance by balance checker
  async getTokenBalances({userAddress, tokenAddress, checkerAddress}) {
    userAddress = Array.isArray(userAddress) ? userAddress : [userAddress];
    tokenAddress = Array.isArray(tokenAddress) ? tokenAddress : [tokenAddress];
    const users = userAddress.map(u => (this.isCfx ? decode(u).hexAddress : u));
    const tokens = tokenAddress.map(t => {
      if (t === '0x0') {
        return '0x0000000000000000000000000000000000000000';
      }
      return this.isCfx ? decode(t).hexAddress : t;
    });

    const data = ifaceChecker.encodeFunctionData('balances', [users, tokens]);
    const res = await this.send(this.callMethod, [
      {
        from: userAddress[0],
        to: checkerAddress,
        data,
      },
      this.params,
    ]).then(r => ifaceChecker.decodeFunctionResult('balances', r));
    const tl = tokenAddress.length;
    const rst = {};
    userAddress.forEach((u, uIndex) => {
      u = u.toLowerCase();
      rst[u] = {};
      tokenAddress.forEach((t, tIndex) => {
        t = t.toLowerCase();
        rst[u][t] = hexValue(res[0][uIndex * tl + tIndex].toHexString());
      });
    });
    // console.log('rst', rst);
    return rst;
  }

  async hasBalance({userAddress, tokenAddress, checkerAddress}) {
    const [r1, r2] = await Promise.all([
      this.getNativeBalance(userAddress),
      this.getTokenBalances({userAddress, tokenAddress, checkerAddress}),
    ]);
    const hasNativeBalance = r1 && r1 !== '0x0';
    const hasToken20Balance =
      r2[userAddress] &&
      Object.values(r2[userAddress]).some(v => v && v !== '0x0');

    const ret = hasNativeBalance || hasToken20Balance;
    console.log('ret', ret);
    return ret;
  }
}

export default Balance;
