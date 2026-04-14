import type { Address as AddressRecord } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import type { RuntimeConfig } from '@core/runtime/types';
import type { AddressValidationService } from '@core/services/address';
import type { EvmUnsignedTransaction, IChainProvider, UnsignedTransaction } from '@core/types';
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

export type TransactionHandlerContext = {
  network: Network;
  chainProvider: IChainProvider;
  config?: RuntimeConfig;
  addressValidationService: AddressValidationReader;
};

export interface TransactionHandlers {
  quoteTransaction(input: TransactionQuoteInput): Promise<TransactionQuote>;
  precheckTransfer(input: { address: AddressRecord; request: PrecheckTransferInput }): Promise<PrecheckTransferResult>;
  reviewTransfer(input: { address: AddressRecord; request: ReviewTransferInput }): Promise<ReviewTransferResult>;
  buildTransferUnsignedTransaction(prepared: PreparedTransfer): Promise<UnsignedTransaction>;
  reviewReplacement(input: { originTx: Tx; request: ReviewReplacementInput }): Promise<ReviewReplacementResult>;
  buildReplacementUnsignedTransaction(prepared: PreparedReplacement): Promise<UnsignedTransaction>;
  reviewDappTransaction(input: { address: AddressRecord; request: ReviewDappTransactionInput }): Promise<ReviewDappTransactionResult>;
  buildDappUnsignedTransaction(prepared: PreparedDappTransaction): Promise<EvmUnsignedTransaction>;
}
