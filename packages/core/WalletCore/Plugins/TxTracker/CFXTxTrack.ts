import type { Tx } from '@core/database/models/Tx';
import { NetworkType } from '@core/database/models/Network';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, TxStatus } from '@core/database/models/Tx/type';
import { RPCResponse, RPCSend, RPCSendFactory } from '@core/utils/send';
import { firstValueFrom } from 'rxjs';
import { BaseTxTrack } from './BaseTxTrack';

export class CFXTxTrack extends BaseTxTrack {
  constructor() {
    super({
      networkType: NetworkType.Conflux,
      logPrefix: 'CFXTxTrack',
    });
  }

  async _checkStatus(txs: Tx[], endpoint: string, returnStatus = false): Promise<TxStatus | undefined> {
    let status: TxStatus | undefined;
    const RPCSend = RPCSendFactory(endpoint);
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'cfx_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await firstValueFrom(RPCSend<RPCResponse<CFX.cfx_getTransactionByHashResponse>[]>(getTransactionByHashParams));
    const executedTxs = txs.filter((tx, index) => {
      const { result: transaction, error } = getTransactionByHashResponses[index];
      if (error) {
        console.log('CFXTxTrack: getTransactionByHash error:', {
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
      //  the transaction is skipped or not packed
      if (transaction.status !== '0x1' && transaction.status !== '0x0') {
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
      return true;
    });
    if (executedTxs.length) {
      const getTransactionReceiptParams = executedTxs.map((tx) => ({ method: 'cfx_getTransactionReceipt', params: [tx.hash] }));
      const getTransactionReceiptResponses = await firstValueFrom(RPCSend<RPCResponse<CFX.cfx_getTransactionReceiptResponse>[]>(getTransactionReceiptParams));
      const receiptMap = new Map<string, CFX.cfx_getTransactionReceiptResponse>();
      const hasReceiptTxs = executedTxs.filter((tx, index) => {
        const { result: receipt, error } = getTransactionReceiptResponses[index];
        if (error) {
          console.log('CFXTxTrack: getTransactionReceipt error:', {
            hash: tx.hash,
            error,
          });
          return false;
        }
        if (!receipt) return false;
        returnStatus && (status = TxStatus.EXECUTED);
        receiptMap.set(tx.hash, receipt);
        return true;
      });
      const getBlockByHashParams = hasReceiptTxs.map((tx) => ({ method: 'cfx_getBlockByHash', params: [receiptMap.get(tx.hash)!.blockHash, false] }));
      getBlockByHashParams.unshift({ method: 'cfx_getStatus', params: [] });
      const [statusResponse, ...getBlockByHashParamsResponses] = await firstValueFrom(
        RPCSend<[RPCResponse<CFX.cfx_getStatusResponse>, ...RPCResponse<CFX.cfx_getBlockByHashResponse>[]]>(getBlockByHashParams),
      );
      let latestBlockNumber: bigint | undefined;
      let safeBlockNumber: bigint | undefined;
      let finalizedBlockNumber: bigint | undefined;
      if (statusResponse.result?.latestState) {
        latestBlockNumber = BigInt(statusResponse.result.latestState);
      }
      if (statusResponse.result?.latestConfirmed) {
        safeBlockNumber = BigInt(statusResponse.result.latestConfirmed);
      }
      if (statusResponse.result?.latestFinalized) {
        finalizedBlockNumber = BigInt(statusResponse.result.latestFinalized);
      }
      await Promise.all(
        hasReceiptTxs.map(async (tx, index) => {
          const { result: block, error } = getBlockByHashParamsResponses[index];
          if (error) {
            console.log('CFXTxTrack: getBlockByHash error:', {
              hash: tx.hash,
              error,
            });
            return false;
          }
          let txStatus = TxStatus.EXECUTED;
          const receipt = receiptMap.get(tx.hash)!;
          const txBlockNumber = BigInt(receipt.epochNumber!);
          let confirmedNumber = 0;
          console.log('CFXTxTrack: blockNumber', txBlockNumber, finalizedBlockNumber, safeBlockNumber, latestBlockNumber);
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
            tx.executedStatus = receipt.outcomeStatus === '0x0' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED;
            tx.receipt = {
              blockHash: receipt.blockHash,
              transactionIndex: receipt.index,
              blockNumber: receipt.epochNumber,
              gasUsed: receipt.gasUsed,
              gasFee: receipt.gasFee,
              storageCollateralized: receipt.storageCollateralized,
              gasCoveredBySponsor: receipt.gasCoveredBySponsor,
              storageCoveredBySponsor: receipt.storageCoveredBySponsor,
              storageReleased: receipt.storageReleased?.length ? receipt.storageReleased : undefined,
              contractCreated: receipt.contractCreated,
            };
            if (block.timestamp) {
              tx.executedAt = new Date(Number(BigInt(block.timestamp)) * 1000);
            }
            if (receipt.outcomeStatus !== '0x0') {
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
    return status;
  }

  async _handleResend(raw: string | null, endpoint: string) {
    return firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'cfx_sendRawTransaction', params: [raw] }));
  }

  async _getTransactionByHash(hash: string, endpoint: string) {
    return firstValueFrom(RPCSend<RPCResponse<CFX.cfx_getTransactionByHashResponse>>(endpoint, { method: 'cfx_getTransactionByHash', params: [hash] }));
  }

  async _getNonce(address: string, endpoint: string) {
    return firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'cfx_getNextNonce', params: [address] }));
  }
}
