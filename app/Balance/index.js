import {
  encode,
  decode,
  validateBase32Address,
} from '@fluent-wallet/base32-address';
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
    this.networkType = networkType;
    this.networkId = networkId;
    this.send = initSend(endpoint).bind(
      null,
      networkType === 'cfx' ? 'cfx_getBalance' : 'eth_getBalance',
    );
    this.params = networkType === 'cfx' ? 'latest_state' : 'latest';
  }
  async getNativeBalance(hex) {
    const ret = await this.send([
      this.networkType === 'cfx'
        ? formatCfxAddress({address: hex, networkId: this.networkId})
        : hex,
      this.params,
    ]);
    console.log('ret', ret);
    return ret;
  }
}

export default Balance;
