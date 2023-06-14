import initSend from '../utils/send';

class Balance {
  constructor(endpoint, networkType) {
    this.send = initSend(endpoint).bind(
      null,
      networkType === 'cfx' ? 'cfx_getBalance' : 'eth_getBalance',
    );
    this.params = networkType === 'cfx' ? 'latest_state' : 'latest';
  }
  async getBalance(hex) {
    const ret = await this.send([hex, this.params]);
    console.log('ret', ret);
    return ret;
  }
}

export default Balance;
