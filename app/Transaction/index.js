import {cfxSignTransaction} from '@fluent-wallet/signature';
import {
  detectCfxAddressType,
  detectEthAddressType,
} from '@fluent-wallet/detect-address-type';
import {getAddressByValueAndNetworkId} from '../Query';
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
  getCfxEpochNumber(...args) {
    return this.send('cfx_epochNumber', ...args);
  }
  getCfxGasPrice() {
    return this.send('cfx_gasPrice');
  }
  getCfxEstimateGasAndCollateral(...args) {
    return this.send('cfx_estimateGasAndCollateral', ...args);
  }
  async getDecryptPk(encryptedDataPk) {
    const {pk} = await encrypt.decrypt(this.password, encryptedDataPk);
    return pk;
  }
  async getCfxNextNonce(...args) {
    try {
      return await this.send('txpool_nextNonce', ...args);
    } catch (err) {
      return await this.send('cfx_getNextNonce', ...args);
    }
  }
  async signCfxTransaction(tx) {
    if (tx.chainId && tx.chainId !== this.network.chainId) {
      throw Error(`Invalid chainId ${tx.chainId}`);
    }

    // const {epoch, returnTxMeta, dryRun} = opts;
    tx.from = tx.from.toLowerCase();
    if (tx.to) {
      tx.to = tx.to.toLowerCase('address');
    }
    const newTx = {...tx};

    const fromAddr = await getAddressByValueAndNetworkId(
      newTx.from,
      this.network.id,
    )?.[0];

    if (!fromAddr) {
      throw Error(`Invalid from address ${newTx.from}`);
    }

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
      const {type} = await this.detectAddressType(
        {errorFallThrough: true},
        {address: newTx.to},
      );
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

    const pk = await this.getDecryptPk(fromAddr.pk);

    const raw = cfxSignTransaction(newTx, pk, this.network.netId);

    return raw;
  }
  sendCfxTransaction() {}
}

export default Transaction;
