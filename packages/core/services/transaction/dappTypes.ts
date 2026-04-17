import type { Address, Hex, TransactionFeeFields } from '@core/types';
import type { TypedDataDomain, TypedDataField } from 'ethers';

export type { EvmRpcTransactionRequest } from '@core/types';

export interface DappTransactionRequest extends TransactionFeeFields<Hex> {
  from: Address;
  to?: Address;
  data?: Hex;
  value?: Hex;
  gas?: Hex;
  nonce?: Hex;
  type?: Hex;
  storageLimit?: Hex; // conflux
}

export type EvmSignableMessage = string | { raw: Hex };

export type EvmTypedDataV4 = {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  message: Record<string, unknown>;
  primaryType?: string;
};

export type EvmSignMessageParameters = {
  from: Address;
  message: EvmSignableMessage;
};

export type EvmSignTypedDataParameters = {
  from: Address;
  typedData: EvmTypedDataV4;
};
