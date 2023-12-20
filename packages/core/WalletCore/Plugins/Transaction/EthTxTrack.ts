import { observeUnfinishedTx, queryDuplicateTx } from '@core/database/models/Tx/query';
import { Tx } from '@core/database/models/Tx';
import { Receipt, TxStatus } from '@core/database/models/Tx/type';
import { RPCResponse, RPCSendFactory } from '@core/utils/send';
import { firstValueFrom } from 'rxjs';
import { delay } from 'lodash-es';
import { DETAULT_TX_TRACK_INTERVAL } from '@core/consts/transaction';
import { ProcessErrorType, processError } from '@core/utils/eth';

type KeepTrackFunction = (delay?: number) => void;

export class EthTxTrack {
  private _txMap = new Map<string, Tx>();

  constructor() {
    this._setup();
  }

  private _setup() {
    observeUnfinishedTx().subscribe((txs) => {
      txs.forEach(async (tx) => {
        if (!this._txMap.has(tx.hash)) {
          console.log('start track:', tx.hash);
          this._txMap.set(tx.hash, tx);
          try {
            const address = await tx.address;
            const network = await address.network;
            const RPCSend = RPCSendFactory(network.endpoint);
            this.trackTx(tx.hash, RPCSend);
          } catch (error) {
            console.error('track tx error:', error);
          }
        }
      });
    });
  }

  private async _updateTx(tx: Tx, updater: (_: Tx) => void, force = false) {
    const inTrack = this._txMap.has(tx.hash);
    if (!inTrack && !force) {
      console.log('tx already finished:', tx.hash);
      return;
    }
    const newTx = await tx.updateSelf(updater);
    inTrack && this._txMap.set(newTx.hash, newTx);
    return newTx;
  }

  private async _handleUnsentTx(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    await this._updateTx(tx, (tx) => {
      tx.status = TxStatus.SENDING;
    });
    const { error } = await firstValueFrom(RPCSend<RPCResponse<string>>({ method: 'eth_sendRawTransaction', params: [tx.raw] }));
    if (!error) {
      await this._updateTx(tx, (tx) => {
        tx.status = TxStatus.PENDING;
        if (!tx.pendingAt) {
          tx.pendingAt = new Date();
        }
      });
      keepTrack();
    } else {
      await this._updateTx(tx, (tx) => {
        tx.status = TxStatus.UNSENT;
      });
      const { errorType, shouldDiscard } = processError(error);
      const isDuplicateTx = errorType === ProcessErrorType.duplicateTx;
      const resendNonceTooStale = tx.resendAt && errorType === ProcessErrorType.tooStaleNonce;
      const resendPriceTooLow = tx.resendAt && errorType === ProcessErrorType.replaceUnderpriced;

      const sameAsSuccess = isDuplicateTx || resendNonceTooStale;
      const failed = !sameAsSuccess && (shouldDiscard || resendPriceTooLow);
      const resend = !shouldDiscard && !sameAsSuccess;
      if (sameAsSuccess) {
        await this._updateTx(tx, (tx) => {
          tx.status = TxStatus.PENDING;
          if (!tx.pendingAt) {
            tx.pendingAt = new Date();
          }
        });
        keepTrack();
      } else if (resend) {
        keepTrack();
      } else if (failed) {
        await this._updateTx(tx, (tx) => {
          tx.status = TxStatus.FAILED;
          tx.err = errorType;
          tx.raw = null;
        });
      }
    }
  }

  private async _handleCheckNonce(tx: Tx, blockNumber: string | null | undefined, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const address = await tx.address;
    const { result: nonce, error } = await firstValueFrom(
      RPCSend<RPCResponse<string>>({ method: 'eth_getTransactionCount', params: [address.hex, blockNumber] })
    );
    if (error) throw error;
    const txNonce = (await tx.txPayload).nonce;
    if (nonce && txNonce && BigInt(nonce) > BigInt(txNonce) + 1n) {
      if (tx.skippedChecked) {
        this._txMap.delete(tx.hash);
        this._updateTx(
          tx,
          (tx) => {
            tx.status = TxStatus.SKIPPED;
            tx.skippedChecked = null;
            tx.raw = null;
          },
          true
        );
      } else {
        await this._updateTx(tx, (tx) => {
          tx.skippedChecked = true;
        });
        keepTrack(0);
      }
      return true;
    }
    return false;
  }

  private async _handlePendingTx(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result: transaction, error } = await firstValueFrom(
      RPCSend<RPCResponse<ETH.eth_getTransactionByHashResponse>>({ method: 'eth_getTransactionByHash', params: [tx.hash] })
    );
    if (error) throw error;
    if (transaction && transaction.blockHash) {
      // Packaged
      await this._updateTx(tx, (tx) => {
        tx.status = TxStatus.PACKAGED;
        tx.blockHash = transaction.blockHash;
        tx.skippedChecked = null;
      });
      const skippedChecked = await this._handleCheckNonce(tx, transaction.blockNumber, keepTrack, RPCSend);
      !skippedChecked && keepTrack(0);
    } else {
      const { result: blockNumber, error } = await firstValueFrom(RPCSend<RPCResponse<string>>({ method: 'eth_blockNumber' }));
      if (error) throw error;
      if (!tx.resendAt && !tx.blockNumber) {
        await this._updateTx(tx, (tx) => {
          tx.status = TxStatus.SENDING;
          tx.resendAt = blockNumber;
        });
      } else if (BigInt(blockNumber) >= BigInt(tx.resendAt || tx.blockNumber!) + 1n) {
        await this._updateTx(tx, (tx) => {
          tx.status = TxStatus.UNSENT;
          tx.resendAt = blockNumber;
        });
      }
      keepTrack();
    }
  }

  private async _handlePackagedTxSwitchChain(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result: transaction, error } = await firstValueFrom(
      RPCSend<RPCResponse<ETH.eth_getTransactionByHashResponse>>({ method: 'eth_getTransactionByHash', params: [tx.hash] })
    );
    if (error) return;
    if (!transaction) {
      await this._updateTx(tx, (tx) => {
        tx.blockHash = null;
        tx.status = TxStatus.PENDING;
        tx.chainSwitched = true;
      });
    } else {
      if (transaction.blockHash !== tx.blockHash) {
        await this._updateTx(tx, (tx) => {
          tx.blockHash = transaction.blockHash;
          tx.status = TxStatus.PACKAGED;
          tx.chainSwitched = true;
          tx.skippedChecked = null;
        });
      }
    }
    keepTrack();
  }

  private async _handlePackagedTx(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result, error } = await firstValueFrom(
      RPCSend<RPCResponse<ETH.eth_getTransactionReceiptResponse>>({ method: 'eth_getTransactionReceipt', params: [tx.hash] })
    );
    if (error) throw error;
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
      const { result: block, error } = await firstValueFrom(
        RPCSend<RPCResponse<ETH.eth_getBlockByHashResponse>>({ method: 'eth_getBlockByHash', params: [blockHash, false] })
      );
      if (error) throw error;
      await this._updateTx(tx, (tx) => {
        tx.status = TxStatus.EXECUTED;
        tx.receipt = receipt;
        tx.skippedChecked = null;
        if (block.timestamp) {
          tx.executedAt = new Date(Number(BigInt(block.timestamp)) * 1000);
        }
      });
      keepTrack(0);
    } else {
      // Failed
      this._txMap.delete(tx.hash);
      this._updateTx(
        tx,
        (tx) => {
          tx.status = TxStatus.FAILED;
          tx.err = (result as any).txExecErrorMsg ?? 'tx failed';
          tx.raw = null;
        },
        true
      );
    }
  }

  private async _handleExecutedTxSwitchChain(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result, error } = await firstValueFrom(
      RPCSend<RPCResponse<ETH.eth_getTransactionReceiptResponse>>({ method: 'eth_getTransactionReceipt', params: [tx.hash] })
    );
    if (error) return;
    if (!result) {
      await this._updateTx(tx, (tx) => {
        tx.receipt = null;
        tx.status = TxStatus.PACKAGED;
        tx.chainSwitched = true;
        tx.skippedChecked = null;
      });
    } else if (
      result.blockHash !== tx.receipt?.blockHash ||
      result.transactionIndex !== tx.receipt?.transactionIndex ||
      result.blockNumber !== tx.receipt?.blockNumber
    ) {
      await this._updateTx(tx, (tx) => {
        tx.receipt = null;
        tx.status = TxStatus.PACKAGED;
        tx.blockHash = result.blockHash;
        tx.chainSwitched = true;
        tx.skippedChecked = null;
      });
      keepTrack();
    }
  }

  private async _handleExecutedTx(tx: Tx, keepTrack: KeepTrackFunction, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const { result: currentBlockNumber, error } = await firstValueFrom(RPCSend<RPCResponse<string>>({ method: 'eth_blockNumber' }));
    if (error) throw error;
    if (currentBlockNumber && BigInt(currentBlockNumber) >= BigInt(tx.receipt!.blockNumber!)) {
      // CONFIRMED
      this._txMap.delete(tx.hash);
      await this._updateTx(
        tx,
        (tx) => {
          tx.status = TxStatus.CONFIRMED;
          tx.skippedChecked = null;
          tx.raw = null;
        },
        true
      );
      this._handleDuplicateTx(tx);
    } else {
      keepTrack();
    }
  }

  private async _handleDuplicateTx(tx: Tx) {
    try {
      const nonce = (await tx.txPayload).nonce;
      const txs = await queryDuplicateTx(tx, nonce!).fetch();
      txs.forEach(async (_tx) => {
        this._txMap.delete(_tx.hash);
        this._updateTx(
          _tx,
          (t) => {
            t.status = TxStatus.FAILED;
            t.err = 'replacedByAnotherTx';
            tx.raw = null;
          },
          true
        );
      });
    } catch (error) {
      console.log(error);
    }
  }

  async trackTx(hash: string, RPCSend: ReturnType<typeof RPCSendFactory>) {
    const tx = this._txMap.get(hash);
    if (!tx) {
      console.log('tx already finished:', hash);
      return;
    }
    const keepTrack = (n = DETAULT_TX_TRACK_INTERVAL) => delay(() => this.trackTx(hash, RPCSend), n);
    try {
      if (tx.status === TxStatus.UNSENT) {
        this._handleUnsentTx(tx, keepTrack, RPCSend);
      } else if (tx.status === TxStatus.SENDING) {
        // SENDING
      } else if (tx.status === TxStatus.PENDING) {
        this._handlePendingTx(tx, keepTrack, RPCSend);
      } else if (tx.status === TxStatus.PACKAGED) {
        this._handlePackagedTxSwitchChain(tx, keepTrack, RPCSend);
        this._handlePackagedTx(tx, keepTrack, RPCSend);
      } else if (tx.status === TxStatus.EXECUTED) {
        this._handleExecutedTxSwitchChain(tx, keepTrack, RPCSend);
        this._handleExecutedTx(tx, keepTrack, RPCSend);
      }
    } catch (error) {
      console.log(error);
      keepTrack();
    }
  }
}
