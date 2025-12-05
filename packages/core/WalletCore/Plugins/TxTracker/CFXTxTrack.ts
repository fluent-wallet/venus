import { fetchChain, fetchChainBatch } from '@cfx-kit/dapp-utils/dist/fetch';
import { type Network, NetworkType } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, TxStatus } from '@core/database/models/Tx/type';
import { MAX_EPOCH_NUMBER_OFFSET_IN_CORE } from '@core/utils/consts';
import BlockNumberTracker from '../BlockNumberTracker';
import { BaseTxTrack, isRPCError, type RPCErrorResponse, type UpdaterMap } from './BaseTxTrack';
import { ReplacedResponse } from './types';

class CFXTxTrack extends BaseTxTrack {
  networkType = NetworkType.Conflux as const;
  constructor() {
    super({
      logPrefix: 'CFXTxTrack',
    });
  }

  async _checkStatus(txs: Tx[], network: Network, updaterMap: UpdaterMap): Promise<TxStatus | undefined> {
    const endpoint = network.endpoint;
    let status: TxStatus | undefined;
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'cfx_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await fetchChainBatch<(CFX.cfx_getTransactionByHashResponse | RPCErrorResponse)[]>({
      url: endpoint,
      rpcs: getTransactionByHashParams,
    });
    const executedTxs = (
      await Promise.all(
        txs.map(async (tx, index) => {
          const transaction = getTransactionByHashResponses[index];
          if (isRPCError(transaction)) {
            console.log('CFXTxTrack: getTransactionByHash error:', {
              hash: tx.hash,
              error: transaction,
            });
            return false;
          }
          if (!transaction) {
            status = await this._handleUnsent(tx, network, updaterMap);
            return false;
          }
          //  the transaction is skipped / not packed / replaced
          if (transaction.status !== '0x1' && transaction.status !== '0x0') {
            const replaceReponse = await this._handleCheckReplaced(tx, endpoint);
            switch (replaceReponse) {
              case ReplacedResponse.NotReplaced:
                status = TxStatus.PENDING;
                await this._setPending(tx, updaterMap);
                break;
              case ReplacedResponse.TempReplaced:
                status = TxStatus.TEMP_REPLACED;
                await this._setTempReplaced(tx, updaterMap);
                break;
              case ReplacedResponse.FinalizedReplaced:
                status = TxStatus.REPLACED;
                if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
                  await this._handleDuplicateTx(tx, false, false, updaterMap);
                }
                this._setReplaced(tx, true, true, updaterMap);
                break;
              default:
                break;
            }
            return false;
          }
          return tx;
        }),
      )
    ).filter((tx) => !!tx);
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
        status = TxStatus.EXECUTED;
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
      let safeBlockNumber: bigint | undefined;
      let finalizedBlockNumber: bigint | undefined;
      if (!isRPCError(statusResponse) && statusResponse) {
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
          if (!block) {
            return false;
          }
          let txStatus = TxStatus.EXECUTED;
          const receipt = receiptMap.get(tx.hash!)!;
          const txBlockNumber = BigInt(receipt.epochNumber!);
          console.log('CFXTxTrack: blockNumber', txBlockNumber, finalizedBlockNumber, safeBlockNumber);
          if (finalizedBlockNumber && txBlockNumber <= finalizedBlockNumber) {
            txStatus = TxStatus.FINALIZED;
            status = TxStatus.FINALIZED;
          } else if (safeBlockNumber && txBlockNumber <= safeBlockNumber) {
            txStatus = TxStatus.CONFIRMED;
            status = TxStatus.CONFIRMED;
          }
          await this._setExecuted(
            tx,
            {
              txStatus,
              executedStatus: receipt.outcomeStatus === '0x0' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED,
              receipt: {
                type: receipt.type || '0x0',
                blockHash: receipt.blockHash,
                transactionIndex: receipt.index,
                blockNumber: receipt.epochNumber,
                gasUsed: receipt.gasUsed,
                gasFee: receipt.gasFee,
                effectiveGasPrice: receipt.effectiveGasPrice,
                storageCollateralized: receipt.storageCollateralized,
                gasCoveredBySponsor: receipt.gasCoveredBySponsor,
                storageCoveredBySponsor: receipt.storageCoveredBySponsor,
                storageReleased: receipt.storageReleased?.length ? receipt.storageReleased : undefined,
                contractCreated: receipt.contractCreated,
              },
              txExecErrorMsg: receipt.outcomeStatus !== '0x0' ? (receipt.txExecErrorMsg ?? 'tx failed') : undefined,
              executedAt: block.timestamp ? new Date(Number(BigInt(block.timestamp)) * 1000) : undefined,
            },
            updaterMap,
          );
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
      return !BlockNumberTracker.checkBlockNumberInRange(network, txblockNumber, [-MAX_EPOCH_NUMBER_OFFSET_IN_CORE, MAX_EPOCH_NUMBER_OFFSET_IN_CORE]);
    } catch (error) {
      console.log('CFXTxTrack: checkEpochHeightOutOfBound error:', {
        hash: tx.hash,
        error,
      });
      return false;
    }
  }

  async _precheckBeforeResend(tx: Tx) {
    const outOfBound = await this._checkEpochHeightOutOfBound(tx);
    return !outOfBound;
  }

  async _getTransactionReceipt(hash: string, endpoint: string) {
    return fetchChain<CFX.cfx_getTransactionReceiptResponse>({
      url: endpoint,
      method: 'cfx_getTransactionReceipt',
      params: [hash],
    });
  }

  async _getNonce(address: string, endpoint: string) {
    let [latestNonce, finalizedNonce] = await fetchChainBatch<(string | RPCErrorResponse)[]>({
      url: endpoint,
      rpcs: [
        { method: 'cfx_getNextNonce', params: [address, 'latest_state'] },
        { method: 'cfx_getNextNonce', params: [address, 'latest_finalized'] },
      ],
    });
    if (isRPCError(finalizedNonce)) {
      finalizedNonce = '0';
    }
    if (isRPCError(latestNonce)) {
      latestNonce = finalizedNonce;
    }
    return {
      latestNonce,
      finalizedNonce,
    };
  }
}

export default new CFXTxTrack();
