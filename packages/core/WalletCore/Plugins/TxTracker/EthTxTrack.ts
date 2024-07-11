import { fetchChain, fetchChainBatch } from '@cfx-kit/dapp-utils/dist/fetch';
import { type Network, NetworkType } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, TxStatus } from '@core/database/models/Tx/type';
import { ProcessErrorType } from '@core/utils/eth';
import { BaseTxTrack, type RPCErrorResponse, isRPCError } from './BaseTxTrack';

class EthTxTrack extends BaseTxTrack {
  networkType = NetworkType.Ethereum as const;
  constructor() {
    super({
      logPrefix: 'EthTxTrack',
    });
  }

  async _checkStatus(txs: Tx[], network: Network, returnStatus = false): Promise<TxStatus | undefined> {
    const endpoint = network.endpoint;
    let status: TxStatus | undefined;
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'eth_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await fetchChainBatch<(ETH.eth_getTransactionByHashResponse | RPCErrorResponse)[]>({
      url: endpoint,
      rpcs: getTransactionByHashParams,
    });
    const txsInPool = txs.filter((tx, index) => {
      const transaction = getTransactionByHashResponses[index];
      if (isRPCError(transaction)) {
        console.log('EthTxTrack: getTransactionByHash error:', {
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
      return true;
    });
    if (txsInPool.length) {
      const getTransactionReceiptParams = txsInPool.map((tx) => ({ method: 'eth_getTransactionReceipt', params: [tx.hash] }));
      const getTransactionReceiptResponses = await fetchChainBatch<(ETH.eth_getTransactionReceiptResponse | RPCErrorResponse)[]>({
        url: endpoint,
        rpcs: getTransactionReceiptParams,
      });
      const receiptMap = new Map<string, ETH.eth_getTransactionReceiptResponse>();
      const executedTxs = txsInPool.filter((tx, index) => {
        const receipt = getTransactionReceiptResponses[index];
        if (isRPCError(receipt)) {
          console.log('EthTxTrack: getTransactionReceipt error:', {
            hash: tx.hash,
            error: receipt,
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
        const [latestBlock, safeBlock, finalizedBlock, ...getBlockByHashParamsResponses] = await fetchChainBatch<
          (ETH.eth_getBlockByHashResponse | RPCErrorResponse)[]
        >({
          url: endpoint,
          rpcs: getBlockByHashParams,
        });
        let latestBlockNumber: bigint | undefined;
        let safeBlockNumber: bigint | undefined;
        let finalizedBlockNumber: bigint | undefined;
        if (!isRPCError(latestBlock) && latestBlock?.number) {
          latestBlockNumber = BigInt(latestBlock.number);
        }
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
    }
    return status;
  }

  async _checkEpochHeightOutOfBound() {
    return false;
  }

  async _getTransactionByHash(hash: string, endpoint: string) {
    return fetchChain<ETH.eth_getTransactionByHashResponse>({
      url: endpoint,
      method: 'eth_getTransactionByHash',
      params: [hash],
    });
  }

  async _getNonce(address: string, endpoint: string) {
    return fetchChain<string>({
      url: endpoint,
      method: 'eth_getTransactionCount',
      params: [address, 'latest'],
    });
  }
}

export default new EthTxTrack();
