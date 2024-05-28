import type { Tx } from '@core/database/models/Tx';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, TxStatus } from '@core/database/models/Tx/type';
import { BaseTxTrack, RPCErrorResponse, isRPCError } from './BaseTxTrack';
import BlockNumberTracker from '../BlockNumberTracker';
import { ProcessErrorType } from '@core/utils/eth';
import { Network, NetworkType } from '@core/database/models/Network';
import { fetchChain, fetchChainBatch } from '@cfx-kit/dapp-utils/dist/fetch';

class CFXTxTrack extends BaseTxTrack {
  networkType = NetworkType.Conflux as const;
  constructor() {
    super({
      logPrefix: 'CFXTxTrack',
    });
  }

  async _checkStatus(txs: Tx[], network: Network, returnStatus = false): Promise<TxStatus | undefined> {
    const endpoint = network.endpoint;
    let status: TxStatus | undefined;
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'cfx_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await fetchChainBatch<(CFX.cfx_getTransactionByHashResponse | RPCErrorResponse)[]>({
      url: endpoint,
      rpcs: getTransactionByHashParams,
    });
    const executedTxs = txs.filter((tx, index) => {
      const transaction = getTransactionByHashResponses[index];
      if (isRPCError(transaction)) {
        console.log('CFXTxTrack: getTransactionByHash error:', {
          hash: tx.hash,
          error: transaction,
        });
        return false;
      }
      if (!transaction) {
        this._handleUnsent(tx, network);
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
      const getTransactionReceiptResponses = await fetchChainBatch<(CFX.cfx_getTransactionReceiptResponse | RPCErrorResponse)[]>({
        url: endpoint,
        rpcs: getTransactionReceiptParams,
      });
      const receiptMap = new Map<string, CFX.cfx_getTransactionReceiptResponse>();
      const hasReceiptTxs = executedTxs.filter((tx, index) => {
        const receipt = getTransactionReceiptResponses[index];
        if (isRPCError(receipt)) {
          console.log('CFXTxTrack: getTransactionReceipt error:', {
            hash: tx.hash,
            error: receipt,
          });
          return false;
        }
        if (!receipt) return false;
        returnStatus && (status = TxStatus.EXECUTED);
        receiptMap.set(tx.hash!, receipt);
        return true;
      });
      const getBlockByHashParams = hasReceiptTxs.map((tx) => ({ method: 'cfx_getBlockByHash', params: [receiptMap.get(tx.hash!)!.blockHash, false] }));
      getBlockByHashParams.unshift({ method: 'cfx_getStatus', params: [] });
      const [statusResponse, ...getBlockByHashParamsResponses] = await fetchChainBatch<
        [CFX.cfx_getStatusResponse | RPCErrorResponse, ...(CFX.cfx_getBlockByHashResponse | RPCErrorResponse)[]]
      >({
        url: endpoint,
        rpcs: getBlockByHashParams,
      });
      let latestBlockNumber: bigint | undefined;
      let safeBlockNumber: bigint | undefined;
      let finalizedBlockNumber: bigint | undefined;
      if (!isRPCError(statusResponse) && statusResponse) {
        if (statusResponse.latestState) {
          latestBlockNumber = BigInt(statusResponse.latestState);
        }
        if (statusResponse.latestConfirmed) {
          safeBlockNumber = BigInt(statusResponse.latestConfirmed);
        }
        if (statusResponse.latestFinalized) {
          finalizedBlockNumber = BigInt(statusResponse.latestFinalized);
        }
      }
      await Promise.all(
        hasReceiptTxs.map(async (tx, index) => {
          const block = getBlockByHashParamsResponses[index];
          if (isRPCError(block)) {
            console.log('CFXTxTrack: getBlockByHash error:', {
              hash: tx.hash,
              error: block,
            });
            return false;
          }
          let txStatus = TxStatus.EXECUTED;
          const receipt = receiptMap.get(tx.hash!)!;
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
              tx.errorType = ProcessErrorType.executeFailed;
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

  async _checkEpochHeightOutOfBound(tx: Tx) {
    try {
      const network = await (await tx.address).network;
      const txblockNumber = (await tx.txPayload).epochHeight;
      if (!txblockNumber) {
        // unexpected case
        throw new Error('epochHeight is required for core tx');
      }
      return !BlockNumberTracker.checkBlockNumberInRange(network, txblockNumber);
    } catch (error) {
      console.log('CFXTxTrack: checkEpochHeightOutOfBound error:', {
        hash: tx.hash,
        error,
      });
      return false;
    }
  }

  async _getTransactionByHash(hash: string, endpoint: string) {
    return fetchChain<CFX.cfx_getTransactionByHashResponse>({
      url: endpoint,
      method: 'cfx_getTransactionByHash',
      params: [hash],
    });
  }

  async _getNonce(address: string, endpoint: string) {
    return fetchChain<string>({
      url: endpoint,
      method: 'cfx_getNextNonce',
      params: [address],
    });
  }
}

export default new CFXTxTrack();