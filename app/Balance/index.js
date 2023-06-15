import {
  encode,
  decode,
  validateBase32Address,
} from '@fluent-wallet/base32-address';
import {hexValue} from '@ethersproject/bytes';
import {
  Interface,
  iface as tokenContractIface,
} from '@fluent-wallet/contract-abis/777.js';
import initSend from '../utils/send';

const checkerContractIface = new Interface([
  {
    constant: true,
    inputs: [
      {name: 'users', type: 'address[]'},
      {name: 'tokens', type: 'address[]'},
    ],
    name: 'balances',
    outputs: [{name: '', type: 'uint256[]'}],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
]);

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
      throw new Error('Invalid base32 address, address type is invalid');
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
  async getNativeBalance(hex) {
    const ret = await this.send(this.getBalanceMethod, [
      this.isCfx
        ? formatCfxAddress({address: hex, networkId: this.networkId})
        : hex,
      this.params,
    ]);
    console.log('ret', ret);
    return ret;
  }
  async callTokenBalance({userAddress, tokenAddress}) {
    userAddress = this.isCfx ? decode(userAddress).hexAddress : userAddress;
    const data = tokenContractIface.encodeFunctionData('balanceOf', [
      userAddress,
    ]);
    const ret = await this.send(this.callMethod, [
      {from: userAddress, to: tokenAddress, data},
      this.params,
    ]).then(r => tokenContractIface.decodeFunctionResult(this.callMethod, r));

    console.log('ret', ret);
    return ret;
  }
  async checkTokenBalance({userAddress, tokenAddress, checkerAddress}) {
    userAddress = Array.isArray(userAddress) ? userAddress : [userAddress];
    tokenAddress = Array.isArray(tokenAddress) ? tokenAddress : [tokenAddress];
    const data = checkerContractIface.encodeFunctionData('balances', [
      userAddress.map(u => (this.isCfx ? decode(u).hexAddress : u)),
      tokenAddress.map(t => {
        if (t === '0x0') {
          return '0x0000000000000000000000000000000000000000';
        }
        return this.isCfx ? decode(t).hexAddress : t;
      }),
    ]);
    const res = await this.send(this.callMethod, [
      {from: userAddress, to: checkerAddress, data},
      this.params,
    ]).then(r => tokenContractIface.decodeFunctionResult(this.callMethod, r));

    const tl = tokenAddress.length;
    const rst = {};

    userAddress.forEach((u, uIndex) => {
      u = u.toLowerCase();
      rst[u] = {};
      tokenAddress.forEach((t, tIndex) => {
        t = t.toLowerCase();
        rst[u][t] = hexValue(res[uIndex * tl + tIndex].toHexString());
      });
    });
    return rst;
  }
}

export default Balance;
