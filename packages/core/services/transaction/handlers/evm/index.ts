import type { EvmChainProviderLike } from '@core/types';
import type { TransactionHandlerContext, TransactionHandlers } from '../types';
import { buildDappUnsignedTransaction, createReviewDappTransactionHandler } from './dapp';
import { createQuoteTransactionHandler } from './quote';
import { buildReplacementUnsignedTransaction, createReviewReplacementHandler } from './replacement';
import { buildTransferUnsignedTransaction, createPrecheckTransferHandler, createReviewTransferHandler } from './transfer';

export function createEvmTransactionHandlers(ctx: TransactionHandlerContext): TransactionHandlers {
  const chainProvider = ctx.chainProvider as EvmChainProviderLike;
  const deps = { ctx, chainProvider };

  return {
    quoteTransaction: createQuoteTransactionHandler(deps),
    precheckTransfer: createPrecheckTransferHandler(deps),
    reviewTransfer: createReviewTransferHandler(deps),
    buildTransferUnsignedTransaction,
    reviewReplacement: createReviewReplacementHandler(deps),
    buildReplacementUnsignedTransaction,
    reviewDappTransaction: createReviewDappTransactionHandler(deps),
    buildDappUnsignedTransaction,
  };
}
