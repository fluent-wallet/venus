import type { Address, Hex } from '@core/types';
import type { TypedDataDomain, TypedDataField } from 'ethers';

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

export type EvmRpcTransactionRequest = {
  from: Address;
  to?: Address;
  data?: Hex;

  value?: Hex;
  gas?: Hex;
  gasPrice?: Hex;
  maxFeePerGas?: Hex;
  maxPriorityFeePerGas?: Hex;

  nonce?: Hex;
  type?: Hex;
};
