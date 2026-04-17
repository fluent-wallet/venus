import type { Address as AddressRecord } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import type { RuntimeConfig } from '@core/runtime/types';
import type { AddressValidationService } from '@core/services/address';
import type { IChainProvider, UnsignedTransaction } from '@core/types';
import type {
  PrecheckTransferInput,
  PrecheckTransferResult,
  PreparedDappTransaction,
  PreparedReplacement,
  PreparedTransfer,
  ReviewDappTransactionInput,
  ReviewDappTransactionResult,
  ReviewReplacementInput,
  ReviewReplacementResult,
  ReviewTransferInput,
  ReviewTransferResult,
  TransactionQuote,
  TransactionQuoteInput,
} from '../stagedTypes';

export type AddressValidationReader = Pick<AddressValidationService, 'isContractAddress'>;

/**
 * Shared runtime dependencies for one chain-family handler set.
 */
export type TransactionHandlerContext = {
  network: Network;
  chainProvider: IChainProvider;
  config?: RuntimeConfig;
  addressValidationService: AddressValidationReader;
};

/**
 * Chain-family transaction handlers used by TransactionService.
 *
 * Flow:
 *   transfer: quote/precheck -> review -> build -> execute
 *   replacement: review -> build -> execute
 *   dapp: review -> build -> execute
 *
 * `review*` resolves chain-family rules and returns a prepared payload.
 * `build*UnsignedTransaction` only converts that prepared payload into an unsigned transaction.
 */
export interface TransactionHandlers {
  quoteTransaction(input: TransactionQuoteInput): Promise<TransactionQuote>;
  precheckTransfer(input: { address: AddressRecord; request: PrecheckTransferInput }): Promise<PrecheckTransferResult>;
  reviewTransfer(input: { address: AddressRecord; request: ReviewTransferInput }): Promise<ReviewTransferResult>;
  buildTransferUnsignedTransaction(prepared: PreparedTransfer): Promise<UnsignedTransaction>;
  reviewReplacement(input: { originTx: Tx; request: ReviewReplacementInput }): Promise<ReviewReplacementResult>;
  buildReplacementUnsignedTransaction(prepared: PreparedReplacement): Promise<UnsignedTransaction>;
  reviewDappTransaction(input: { address: AddressRecord; request: ReviewDappTransactionInput }): Promise<ReviewDappTransactionResult>;
  buildDappUnsignedTransaction(prepared: PreparedDappTransaction): Promise<UnsignedTransaction>;
}
