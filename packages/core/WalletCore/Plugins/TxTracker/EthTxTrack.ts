import type { Tx } from '@core/database/models/Tx';
import { NetworkType } from '@core/database/models/Network';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, TxStatus } from '@core/database/models/Tx/type';
import { RPCResponse, RPCSend, RPCSendFactory } from '@core/utils/send';
import { firstValueFrom } from 'rxjs';
import { BaseTxTrack } from './BaseTxTrack';

export class EthTxTrack extends BaseTxTrack {
  constructor() {
    super({
      networkType: NetworkType.Ethereum,
      logPrefix: 'EthTxTrack',
    });
  }

  async _checkStatus(txs: Tx[], endpoint: string, returnStatus = false): Promise<TxStatus | undefined> {
    let status: TxStatus | undefined;
    const RPCSend = RPCSendFactory(endpoint);
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'eth_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await firstValueFrom(RPCSend<RPCResponse<ETH.eth_getTransactionByHashResponse>[]>(getTransactionByHashParams));
    const txsInPool = txs.filter((tx, index) => {
      const { result: transaction, error } = getTransactionByHashResponses[index];
      if (error) {
        console.log('EthTxTrack: getTransactionByHash error:', {
          hash: tx.hash,
          error,
        });
        return false;
      }
      if (!transaction) {
        this._handleUnsent(tx, endpoint);
        if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
          this._handleDuplicateTx(tx, false, false);
        }
        returnStatus && (status = TxStatus.UNSENT);
        return false;
      }
      return true;
    });
    if (txsInPool.length) {
      const getTransactionReceiptParams = txsInPool.map((tx) => ({ method: 'eth_getTransactionReceipt', params: [tx.hash] }));
      const getTransactionReceiptResponses = await firstValueFrom(RPCSend<RPCResponse<ETH.eth_getTransactionReceiptResponse>[]>(getTransactionReceiptParams));
      const receiptMap = new Map<string, ETH.eth_getTransactionReceiptResponse>();
      const executedTxs = txsInPool.filter((tx, index) => {
        const { result: receipt, error } = getTransactionReceiptResponses[index];
        if (error) {
          console.log('EthTxTrack: getTransactionReceipt error:', {
            hash: tx.hash,
            error,
          });
          return false;
        }
        if (!receipt || !receipt.status) {
          returnStatus && (status = TxStatus.PENDING);
          tx.updateSelf((tx) => {
            tx.status = TxStatus.PENDING;
            tx.executedStatus = null;
            tx.receipt = null;
            tx.pollingCount = (tx.pollingCount ?? 0) + 1;
          }).then(() => {
            if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
              this._handleDuplicateTx(tx, false, false);
            }
          });
          return false;
        }
        returnStatus && (status = TxStatus.EXECUTED);
        receiptMap.set(tx.hash!, receipt);
        return true;
      });
      if (executedTxs.length) {
        const getBlockByHashParams = executedTxs.map((tx) => ({ method: 'eth_getBlockByHash', params: [receiptMap.get(tx.hash!)!.blockHash, false] }));
        getBlockByHashParams.unshift(
          { method: 'eth_getBlockByNumber', params: ['latest', false] },
          { method: 'eth_getBlockByNumber', params: ['safe', false] },
          { method: 'eth_getBlockByNumber', params: ['finalized', false] },
        );
        const [latestBlock, safeBlock, finalizedBlock, ...getBlockByHashParamsResponses] = await firstValueFrom(
          RPCSend<RPCResponse<ETH.eth_getBlockByHashResponse>[]>(getBlockByHashParams),
        );
        let latestBlockNumber: bigint | undefined;
        let safeBlockNumber: bigint | undefined;
        let finalizedBlockNumber: bigint | undefined;
        if (latestBlock.result?.number) {
          latestBlockNumber = BigInt(latestBlock.result.number);
        }
        if (safeBlock.result?.number) {
          safeBlockNumber = BigInt(safeBlock.result.number);
        }
        if (finalizedBlock.result?.number) {
          finalizedBlockNumber = BigInt(finalizedBlock.result.number);
        }
        await Promise.all(
          executedTxs.map(async (tx, index) => {
            const { result: block, error } = getBlockByHashParamsResponses[index];
            if (error) {
              console.log('EthTxTrack: getBlockByHash error:', {
                hash: tx.hash,
                error,
              });
              return false;
            }
            let txStatus = TxStatus.EXECUTED;
            const receipt = receiptMap.get(tx.hash!)!;
            const txBlockNumber = BigInt(receipt.blockNumber!);
            let confirmedNumber = 0;
            console.log('EthTxTrack: blockNumber', txBlockNumber, finalizedBlockNumber, safeBlockNumber, latestBlockNumber);
            if (finalizedBlockNumber && txBlockNumber <= finalizedBlockNumber) {
              txStatus = TxStatus.FINALIZED;
              returnStatus && (status = TxStatus.FINALIZED);
            } else if (safeBlockNumber && txBlockNumber <= safeBlockNumber) {
              txStatus = TxStatus.CONFIRMED;
              returnStatus && (status = TxStatus.CONFIRMED);
            }
            if (latestBlockNumber) {
              confirmedNumber = Math.max(0, Number(latestBlockNumber - txBlockNumber));
            }
            await tx.updateSelf((tx) => {
              if (txStatus === TxStatus.FINALIZED) {
                tx.raw = null;
              }
              tx.status = txStatus;
              tx.executedStatus = receipt.status === '0x1' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED;
              tx.receipt = {
                cumulativeGasUsed: receipt.cumulativeGasUsed,
                effectiveGasPrice: receipt.effectiveGasPrice,
                type: receipt.type || '0x0',
                blockHash: receipt.blockHash,
                transactionIndex: receipt.transactionIndex,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                contractCreated: receipt.contractAddress,
              };
              if (block.timestamp) {
                tx.executedAt = new Date(Number(BigInt(block.timestamp)) * 1000);
              }
              if (receipt.status !== '0x1') {
                tx.err = receipt.txExecErrorMsg ?? 'tx failed';
              }
              tx.pollingCount = (tx.pollingCount ?? 0) + 1;
              tx.confirmedNumber = confirmedNumber;
            });
            if (tx.status !== txStatus) {
              this._handleDuplicateTx(tx, true, txStatus === TxStatus.FINALIZED);
              if (txStatus === TxStatus.EXECUTED) {
                this._updateTokenBalance(tx);
              }
            }
          }),
        );
      }
    }
    return status;
  }

  async _checkEpochHeightOutOfBound() {
    return false;
  }
  async _handleResend(raw: string | null, endpoint: string) {
    return firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'eth_sendRawTransaction', params: [raw] }));
  }

  async _getTransactionByHash(hash: string, endpoint: string) {
    return firstValueFrom(RPCSend<RPCResponse<ETH.eth_getTransactionByHashResponse>>(endpoint, { method: 'eth_getTransactionByHash', params: [hash] }));
  }

  async _getNonce(address: string, endpoint: string) {
    return firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'eth_getTransactionCount', params: [address, 'latest'] }));
  }
}
