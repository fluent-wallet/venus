import { observeUnfinishedTx } from '@core/database/models/Tx/query';
import { Tx } from '@core/database/models/Tx';
import { Receipt, TxStatus } from '@core/database/models/Tx/type';
import { RPCResponse, RPCSendFactory } from '@core/utils/send';
import { firstValueFrom } from 'rxjs';
import { delay } from 'lodash-es';
import { DETAULT_TX_TRACK_INTERVAL } from '@core/consts/transaction';
import { Address } from '@core/database/models/Address';

type KeepTrackFunction = (params?: { tx?: Tx; delay?: number }) => void;

export class EthTxTrack {
  private _txMap = new Map<string, unknown>();

  constructor() {
    this._setup();
  }

  private _setup() {
    observeUnfinishedTx().subscribe((txs) => {
      txs.forEach(async (tx) => {
        if (!this._txMap.has(tx.hash)) {
          this._txMap.set(tx.hash, tx);
          try {
            const address = await tx.address;
            const network = await address.network;
            const RPCSend = RPCSendFactory(network.endpoint);
            this.trackTx(tx, address, RPCSend);
          } catch (error) {
            console.error('track tx error:', error);
          }
        }
      });
    });
  }

  // async _handleCheckSkipped(tx: Tx, transaction: ETH.eth_getTransactionByHashResponse, address: Address, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
  //   const { result: nonce } = await firstValueFrom(RPCSend<RPCResponse<string>>({ method: 'eth_getTransactionCount', params: [address.hex, transaction.blockNumber] }));
  //   const txNonce = (await tx.txPayload).nonce;
  //   if (
  //     BigInt(nonce) > BigInt(txNonce!) + 1n
  //   ) {
  //     if (tx.skippedChecked) {
  //       tx.updateSelf((tx) => {
  //         tx.status = TxStatus.SKIPPED;
  //       });
  //       return true;
  //     } else {
  //       await tx.updateSelf((tx) => {
  //         tx.skippedChecked = true;
  //       });
  //     }
  //   }
  // }

  private async _handlePendingTx(tx: Tx, address: Address, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result: transaction } = await firstValueFrom(
      RPCSend<RPCResponse<ETH.eth_getTransactionByHashResponse>>({ method: 'eth_getTransactionByHash', params: [tx.hash] })
    );
    if (transaction && transaction.blockHash) {
      // Packaged
      const newTx = await tx.updateSelf((tx) => {
        tx.status = TxStatus.PACKAGED;
        tx.blockHash = transaction.blockHash;
      });
      // TODO: check nonce
      keepTrack({
        tx: newTx,
        delay: 0,
      });
    } else {
      // TODO
    }
  }

  private async _handlePackagedTx(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result } = await firstValueFrom(
      RPCSend<RPCResponse<ETH.eth_getTransactionReceiptResponse>>({ method: 'eth_getTransactionReceipt', params: [tx.hash] })
    );
    if (!result) {
      keepTrack();
      return;
    }
    const { status, blockHash, transactionIndex, blockNumber, contractAddress, cumulativeGasUsed, effectiveGasPrice, gasUsed, type } = result;
    if (status === '0x1') {
      // Executed
      const receipt: Receipt = {
        cumulativeGasUsed,
        effectiveGasPrice,
        type: type || '0x0',
        blockHash,
        transactionIndex,
        blockNumber,
        gasUsed,
        contractCreated: contractAddress,
      };
      const newTx = await tx.updateSelf((tx) => {
        tx.status = TxStatus.EXECUTED;
        tx.receipt = receipt;
      });
      keepTrack({
        tx: newTx,
        delay: 0,
      });
    } else {
      // Failed
      this._txMap.delete(tx.hash);
      tx.updateSelf((tx) => {
        tx.status = TxStatus.FAILED;
        tx.err = (result as any).txExecErrorMsg ?? 'unknown error';
      });
    }
  }

  private async _handleExecutedTx(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result: currentBlockNumber } = await firstValueFrom(RPCSend<RPCResponse<string>>({ method: 'eth_blockNumber' }));
    if (currentBlockNumber && BigInt(currentBlockNumber) >= BigInt(tx.receipt!.blockNumber!)) {
      // CONFIRMED
      this._txMap.delete(tx.hash);
      tx.updateSelf((tx) => {
        tx.status = TxStatus.CONFIRMED;
      });
    } else {
      keepTrack();
    }
  }

  async trackTx(tx: Tx, address: Address, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const keepTrack = ({ tx: newTx = tx, delay: n = DETAULT_TX_TRACK_INTERVAL } = {}) => delay(() => this.trackTx(newTx, address, RPCSend), n);
    try {
      if (tx.status === TxStatus.UNSENT) {
        // TODO
      } else if (tx.status === TxStatus.SENDING) {
        // TODO
      } else if (tx.status === TxStatus.PENDING) {
        this._handlePendingTx(tx, address, keepTrack, RPCSend);
      } else if (tx.status === TxStatus.PACKAGED) {
        this._handlePackagedTx(tx, keepTrack, RPCSend);
      } else if (tx.status === TxStatus.EXECUTED) {
        this._handleExecutedTx(tx, keepTrack, RPCSend);
      }
    } catch (error) {
      keepTrack();
    }
  }
}
