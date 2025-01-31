import { fetchChain, fetchChainBatch } from '@cfx-kit/dapp-utils/dist/fetch';
import { type Network, NetworkType } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, TxStatus } from '@core/database/models/Tx/type';
import { BaseTxTrack, type RPCErrorResponse, type UpdaterMap, isRPCError } from './BaseTxTrack';
import { ReplacedResponse } from './types';

class EthTxTrack extends BaseTxTrack {
  networkType = NetworkType.Ethereum as const;
  constructor() {
    super({
      logPrefix: 'EthTxTrack',
    });
  }

  async _checkStatus(txs: Tx[], network: Network, updaterMap: UpdaterMap): Promise<TxStatus | undefined> {
    const endpoint = network.endpoint;
    let status: TxStatus | undefined;
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'eth_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await fetchChainBatch<(ETH.eth_getTransactionByHashResponse | RPCErrorResponse)[]>({
      url: endpoint,
      rpcs: getTransactionByHashParams,
    });
    const txsInPool = (
      await Promise.all(
        txs.map(async (tx, index) => {
          const transaction = getTransactionByHashResponses[index];
          if (isRPCError(transaction)) {
            console.log('EthTxTrack: getTransactionByHash error:', {
              hash: tx.hash,
              error: transaction,
            });
            return false;
          }
          if (!transaction) {
            status = await this._handleUnsent(tx, network, updaterMap);
            return false;
          }
          return tx;
        }),
      )
    ).filter((tx) => !!tx);
    if (txsInPool.length) {
      const getTransactionReceiptParams = txsInPool.map((tx) => ({ method: 'eth_getTransactionReceipt', params: [tx.hash] }));
      const getTransactionReceiptResponses = await fetchChainBatch<(ETH.eth_getTransactionReceiptResponse | RPCErrorResponse)[]>({
        url: endpoint,
        rpcs: getTransactionReceiptParams,
      });
      const receiptMap = new Map<string, ETH.eth_getTransactionReceiptResponse>();
      const executedTxs = (
        await Promise.all(
          txsInPool.map(async (tx, index) => {
            const receipt = getTransactionReceiptResponses[index];
            if (isRPCError(receipt)) {
              console.log('EthTxTrack: getTransactionReceipt error:', {
                hash: tx.hash,
                error: receipt,
              });
              return false;
            }
            if (!receipt) {
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
            if (!receipt.status) {
              status = TxStatus.PENDING;
              await this._setPending(tx, updaterMap);
              return false;
            }
            receiptMap.set(tx.hash!, receipt);
            return tx;
          }),
        )
      ).filter((tx) => !!tx);
      if (executedTxs.length) {
        status = TxStatus.EXECUTED;
        const getBlockByHashParams = executedTxs.map((tx) => ({ method: 'eth_getBlockByHash', params: [receiptMap.get(tx.hash!)!.blockHash, false] }));
        getBlockByHashParams.unshift(
          { method: 'eth_getBlockByNumber', params: ['safe', false] },
          { method: 'eth_getBlockByNumber', params: ['finalized', false] },
        );
        const [safeBlock, finalizedBlock, ...getBlockByHashParamsResponses] = await fetchChainBatch<(ETH.eth_getBlockByHashResponse | RPCErrorResponse)[]>({
          url: endpoint,
          rpcs: getBlockByHashParams,
        });
        let safeBlockNumber: bigint | undefined;
        let finalizedBlockNumber: bigint | undefined;
        if (!isRPCError(safeBlock) && safeBlock?.number) {
          safeBlockNumber = BigInt(safeBlock.number);
        }
        if (!isRPCError(finalizedBlock) && finalizedBlock?.number) {
          finalizedBlockNumber = BigInt(finalizedBlock.number);
        }
        await Promise.all(
          executedTxs.map(async (tx, index) => {
            const block = getBlockByHashParamsResponses[index];
            if (isRPCError(block)) {
              console.log('EthTxTrack: getBlockByHash error:', {
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
            const txBlockNumber = BigInt(receipt.blockNumber!);
            console.log('EthTxTrack: blockNumber', txBlockNumber, finalizedBlockNumber, safeBlockNumber);
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
                executedStatus: receipt.status === '0x1' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED,
                receipt: {
                  cumulativeGasUsed: receipt.cumulativeGasUsed,
                  effectiveGasPrice: receipt.effectiveGasPrice,
                  type: receipt.type || '0x0',
                  blockHash: receipt.blockHash,
                  transactionIndex: receipt.transactionIndex,
                  blockNumber: receipt.blockNumber,
                  gasUsed: receipt.gasUsed,
                  contractCreated: receipt.contractAddress,
                },
                txExecErrorMsg: receipt.status !== '0x1' ? receipt.txExecErrorMsg ?? 'tx failed' : undefined,
                executedAt: block.timestamp ? new Date(Number(BigInt(block.timestamp)) * 1000) : undefined,
              },
              updaterMap,
            );
          }),
        );
      }
    }
    return status;
  }

  async _precheckBeforeResend() {
    return true;
  }

  async _getTransactionReceipt(hash: string, endpoint: string) {
    return fetchChain<ETH.eth_getTransactionReceiptResponse>({
      url: endpoint,
      method: 'eth_getTransactionReceipt',
      params: [hash],
    });
  }

  async _getNonce(address: string, endpoint: string) {
    let [latestNonce, finalizedNonce] = await fetchChainBatch<(string | RPCErrorResponse)[]>({
      url: endpoint,
      rpcs: [
        { method: 'eth_getTransactionCount', params: [address, 'latest'] },
        { method: 'eth_getTransactionCount', params: [address, 'finalized'] },
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

export default new EthTxTrack();
