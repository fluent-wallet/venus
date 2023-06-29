import {cfxSignTransaction, getTxHashFromRawTx} from '@fluent-wallet/signature';
import {
  detectCfxAddressType,
  detectEthAddressType,
} from '@fluent-wallet/detect-address-type';
import {getAddressByValueAndNetworkId, getTxByAddrAndHash} from '../Query';
import database from '../Database';
import initSend from '../utils/send';
import Encrypt from '../utils/encrypt';

const encrypt = new Encrypt();

class Transaction {
  constructor({endpoint, network, password}) {
    this.network = network;
    this.isCfx = network.networkType === 'cfx';
    this.send = initSend(endpoint);
    this.password = password;
  }
  async detectAddressType(address) {
    if (this.isCfx) {
      return await detectCfxAddressType(address);
    } else {
      return await detectEthAddressType(address, {
        request({method, params}) {
          return this.send(method, params);
        },
      });
    }
  }

  _preCreateTxExtra(params) {
    return database.get('tx_extra').prepareCreate(r => {
      for (const [key, value] of Object.entries(params)) {
        r[key] = value;
      }
    });
  }
  _preCreateTxPayload(params) {
    return database.get('tx_payload').prepareCreate(r => {
      for (const [key, value] of Object.entries(params)) {
        r[key] = value;
      }
    });
  }
  _preCreateTx(params) {
    const {token, address, txExtra, txPayload, ...rest} = params;

    return database.get('tx').prepareCreate(r => {
      for (const [key, value] of Object.entries(rest)) {
        r[key] = value;
      }
      token && r.token.set(token);
      address && r.address.set(address);
      txExtra && r.txExtra.set(txExtra);
      txPayload && r.txPayload.set(txPayload);
    });
  }
  async createTx() {
    return await database.write(async () => {
      await database.batch();
    });
  }
  getCfxEpochNumber(...args) {
    return this.send('cfx_epochNumber', ...args);
  }
  getCfxGasPrice() {
    return this.send('cfx_gasPrice');
  }
  getCfxEstimateGasAndCollateral(...args) {
    return this.send('cfx_estimateGasAndCollateral', ...args);
  }
  getEthBlockNumber() {
    return this.send('eth_blockNumber', []);
  }
  async getDecryptPk(encryptedDataPk) {
    const {pk} = await encrypt.decrypt(this.password, encryptedDataPk);
    return pk;
  }
  async sendRawTransaction(raw) {
    return this.send(
      this.isCfx ? 'cfx_sendRawTransaction' : 'eth_sendRawTransaction',
      [raw],
    );
  }
  async getCfxNextNonce(...args) {
    try {
      return await this.send('txpool_nextNonce', ...args);
    } catch (err) {
      return await this.send('cfx_getNextNonce', ...args);
    }
  }
  async signCfxTransaction(tx, addressRecord) {
    if (tx.chainId && tx.chainId !== this.network.chainId) {
      throw Error(`Invalid chainId ${tx.chainId}`);
    }

    // const {epoch, returnTxMeta, dryRun} = opts;
    tx.from = tx.from.toLowerCase();
    if (tx.to) {
      tx.to = tx.to.toLowerCase('address');
    }
    const newTx = {...tx};

    // tx without to must have data (deploy contract)
    if (!newTx.to && !newTx.data) {
      throw Error("Invalid tx, [to] and [data] can't be omit at the same time");
    }

    if (!newTx.chainId) {
      newTx.chainId = this.network.chainId;
    }
    if (newTx.data === '0x') {
      newTx.data = undefined;
    }

    if (!newTx.value) {
      newTx.value = '0x0';
    }

    if (!newTx.epochHeight) {
      newTx.epochHeight = await this.getCfxEpochNumber(['latest_state']);
    }

    if (!newTx.nonce) {
      newTx.nonce = await this.getCfxNextNonce([newTx.from]);
    }
    if (newTx.to && (!newTx.gas || !newTx.storageLimit)) {
      const {type} = await this.detectAddressType(newTx.to);
      if (type !== 'contract' && !newTx.data) {
        if (!newTx.gas) {
          newTx.gas = '0x5208';
        }
        if (!newTx.storageLimit) {
          newTx.storageLimit = '0x0';
        }
      }
    }

    if (!newTx.gasPrice) {
      newTx.gasPrice = await this.getCfxGasPrice();
    }
    if (!newTx.gas || !newTx.storageLimit) {
      try {
        const {gasLimit, storageCollateralized} =
          await this.getCfxEstimateGasAndCollateral([newTx]);

        if (!newTx.gas) {
          newTx.gas = gasLimit;
        }
        if (!newTx.storageLimit) {
          newTx.storageLimit = storageCollateralized;
        }
      } catch (err) {
        throw err;
      }
    }

    const pk = await this.getDecryptPk(addressRecord.pk);
    const raw = cfxSignTransaction(newTx, pk, this.network.netId);

    return {raw, payload: newTx};
  }
  async signEthTransaction() {}
  async sendCfxTransaction({tx, sendAction, token}) {
    const addressRecord = await getAddressByValueAndNetworkId(
      tx.from,
      this.network.id,
    );

    if (!addressRecord) {
      throw Error(`Invalid from address ${tx.from}`);
    }
    const signTxFn = this.isCfx
      ? this.signCfxTransaction.bind(this)
      : this.signEthTransaction.bind(this);
    let signed;
    try {
      signed = await signTxFn(tx, addressRecord);
    } catch (err) {
      throw err;
    }
    if (!signed) {
      throw Error('Server error while signing tx');
    }
    const {raw, payload} = signed;
    const txhash = getTxHashFromRawTx(raw);
    const dupTx = await getTxByAddrAndHash(txhash, addressRecord.id);
    if (dupTx?.length) {
      throw Error('duplicate tx');
    }
    const blockNumber = !this.isCfx && (await this.getEthBlockNumber());
    await this.sendRawTransaction(raw);
    database.write(async () => {
      await database.batch(this._preCreateTxExtra({hash: txhash}));
    });
  }
}

export default Transaction;
