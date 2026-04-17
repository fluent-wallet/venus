import type { ConfluxChainProviderLike } from '@core/types';
import type { TransactionHandlerContext, TransactionHandlers } from '../types';
import { createBuildDappUnsignedTransactionHandler, createReviewDappTransactionHandler } from './dapp';
import { createQuoteTransactionHandler } from './quote';
import { createBuildReplacementUnsignedTransactionHandler, createReviewReplacementHandler } from './replacement';
import { createBuildTransferUnsignedTransactionHandler, createPrecheckTransferHandler, createReviewTransferHandler } from './transfer';

export function createConfluxTransactionHandlers(ctx: TransactionHandlerContext): TransactionHandlers {
  const chainProvider = ctx.chainProvider as ConfluxChainProviderLike;
  const deps = { ctx, chainProvider };

  return {
    quoteTransaction: createQuoteTransactionHandler(deps),
    precheckTransfer: createPrecheckTransferHandler(deps),
    reviewTransfer: createReviewTransferHandler(deps),
    buildTransferUnsignedTransaction: createBuildTransferUnsignedTransactionHandler(deps),

    reviewReplacement: createReviewReplacementHandler(deps),
    buildReplacementUnsignedTransaction: createBuildReplacementUnsignedTransactionHandler(deps),

    reviewDappTransaction: createReviewDappTransactionHandler(deps),
    buildDappUnsignedTransaction: createBuildDappUnsignedTransactionHandler(deps),
  };
}
