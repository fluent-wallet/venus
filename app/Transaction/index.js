import BN from 'bn.js';
import {parseUnits} from '@ethersproject/units';
import {
  cfxSignTransaction,
  ethSignTransaction,
  getTxHashFromRawTx,
} from '@fluent-wallet/signature';
import {
  detectCfxAddressType,
  detectEthAddressType,
} from '@fluent-wallet/detect-address-type';
import {ETH_TX_TYPES} from '../Consts/network';
import {getAddressByValueAndNetworkId, getTxByAddrAndHash} from '../Query';
import database from '../Database';
import initSend from '../utils/send';
import Encrypt from '../utils/encrypt';
import {
  toEthersTx,
  FEE_HISTORY_BLOCKS,
  FEE_HISTORY_PERCENTILES,
  getGasFeeByGasStation,
  calculateGasFeeEstimatesForPriorityLevels,
} from './utils';
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
  getEthBlockByNumber(...args) {
    return this.send('eth_getBlockByNumber', ...args);
  }
  getEthTransactionCount(...args) {
    return this.send('eth_getTransactionCount', ...args);
  }
  getEthGasPrice(...args) {
    return this.send('eth_gasPrice', ...args);
  }
  getEthFeeHistory(...args) {
    return this.send('eth_feeHistory', ...args);
  }
  getEthEstimateGas(...args) {
    let [tx, block] = args;
    block = block || 'latest';
    if (tx.type === '0x0' || !tx.type) {
      const {type, ...rest} = tx;
      tx = rest;
    }
    return this.send('eth_estimateGas', [tx, block]);
  }
  async getEip1559Compatible() {
    const block = await this.getEthBlockByNumber(['latest', false]);
    if (block && block.baseFeePerGas) {
      return true;
    }
    return false;
  }
  async estimateEth1559Fee() {
    let gasInfo = {};
    const latestBlock = await this.getEthBlockByNumber(['latest', false]);
    try {
      gasInfo = await getGasFeeByGasStation(Number(this.network.chainId));
    } catch (error) {
      const baseFeePerGas = new BN(Number(latestBlock?.baseFeePerGas));
      const feeData = await this.getEthFeeHistory([
        FEE_HISTORY_BLOCKS,
        'latest',
        FEE_HISTORY_PERCENTILES,
      ]);
      gasInfo = calculateGasFeeEstimatesForPriorityLevels(
        feeData,
        baseFeePerGas,
      );
    }
    return gasInfo;
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
  async signEthTransaction(tx, addressRecord, block) {
    const newTx = {...tx};
    const network1559Compatible = await this.getEip1559Compatible();
    if (!newTx.type) {
      if (network1559Compatible) {
        newTx.type = ETH_TX_TYPES.EIP1559;
      } else {
        newTx.type = ETH_TX_TYPES.LEGACY;
      }
    }

    // tx without to must have data (deploy contract)
    if (!newTx.to && !newTx.data) {
      throw Error("Invalid tx, [to] and [data] can't be omit at the same time");
    }

    if (newTx.data === '0x') {
      newTx.data = undefined;
    }
    if (!newTx.value) {
      newTx.value = '0x0';
    }

    if (!newTx.nonce) {
      newTx.nonce = await this.getEthTransactionCount([newTx.from, 'pending']);
    }
    // EIP-1559
    const is1559Tx = newTx.type === ETH_TX_TYPES.EIP1559;
    if (is1559Tx && !network1559Compatible) {
      throw Error(
        `Network ${this.network.name} don't support 1559 transaction`,
      );
    }

    if (!is1559Tx && !newTx.gasPrice) {
      newTx.gasPrice = await this.getEthGasPrice([]);
    }

    if (newTx.to && !newTx.gas) {
      const {contract: typeContract} = await this.detectAddressType(newTx.to);
      if (!typeContract && !newTx.data) {
        if (!newTx.gas) {
          newTx.gas = '0x5208';
        }
      }
    }
    if (!newTx.gas) {
      newTx.gas = await this.getEthEstimateGas([newTx, block || 'latest']);
    }

    if (!newTx.chainId) {
      newTx.chainId = this.network.chainId;
    }
    if (is1559Tx && network1559Compatible) {
      const gasInfoEip1559 = await this.estimateEth1559Fee();
      const {suggestedMaxPriorityFeePerGas, suggestedMaxFeePerGas} =
        gasInfoEip1559?.medium || {};
      if (!newTx.maxPriorityFeePerGas) {
        newTx.maxPriorityFeePerGas = parseUnits(
          suggestedMaxPriorityFeePerGas,
          'gwei',
        ).toHexString();
      }
      if (!newTx.maxFeePerGas) {
        newTx.maxFeePerGas = parseUnits(
          suggestedMaxFeePerGas,
          'gwei',
        ).toHexString();
      }
    }
    let raw;

    const pk = await this.getDecryptPk(addressRecord.pk);

    raw = ethSignTransaction(toEthersTx(newTx), pk);

    return {txMeta: newTx, raw};
  }
  async sendTransaction({tx, sendAction, token}) {
    if (tx.chainId && tx.chainId !== this.network.chainId) {
      throw Error(`Invalid chainId ${tx.chainId}`);
    }
    tx.from = tx.from.toLowerCase();
    tx.to = tx?.to?.toLowerCase();
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
