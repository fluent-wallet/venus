import type { TransactionHandlerContext, TransactionHandlers } from '../types';

export function createConfluxTransactionHandlers(ctx: TransactionHandlerContext): TransactionHandlers {
  return {
    async quoteTransaction() {},

    async precheckTransfer() {},

    async reviewTransfer() {},

    async buildTransferUnsignedTransaction() {},

    async reviewReplacement() {},

    async buildReplacementUnsignedTransaction() {},

    async reviewDappTransaction() {},

    async buildDappUnsignedTransaction() {},
  };
}
