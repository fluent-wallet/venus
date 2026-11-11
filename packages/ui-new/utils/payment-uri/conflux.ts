import { decode } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import { formatParams, readAmount, readUri } from './params';
import type { PaymentRequest } from './types';

export function parseConfluxUri(input: string): PaymentRequest {
  const { path, params } = readUri(input);
  const parts = path.split('/');
  const [recipientAddress, method] = parts;
  if (parts.length > 2 || (method !== undefined && method !== 'transfer')) {
    throw new Error('Unsupported Conflux payment method.');
  }

  const { netId } = decode(recipientAddress);
  const contractAddress = params.get('address');
  if ((contractAddress !== null && method !== 'transfer') || (params.has('value') && params.has('uint256'))) {
    throw new Error('Conflicting Conflux payment parameters.');
  }
  if (contractAddress !== null && decode(contractAddress).netId !== netId) {
    throw new Error('Token and recipient must belong to the same Conflux network.');
  }

  return {
    networkType: NetworkType.Conflux,
    // Supported Core networks use the address network ID as the chain ID.
    chainId: BigInt(netId),
    recipientAddress,
    asset: contractAddress === null ? { type: 'native' } : { type: 'erc20', contractAddress },
    amountBaseUnits: readAmount(params.get('value') ?? params.get('uint256')),
  };
}

export function encodeConfluxUri(payment: PaymentRequest): string {
  const { recipientAddress, asset, amountBaseUnits, chainId } = payment;
  const { netId } = decode(recipientAddress);
  if (chainId !== undefined && BigInt(netId) !== chainId) {
    throw new Error('Recipient does not belong to the requested Conflux network.');
  }

  if (asset.type === 'native') return recipientAddress + formatParams({ value: amountBaseUnits });
  if (decode(asset.contractAddress).netId !== netId) {
    throw new Error('Token and recipient must belong to the same Conflux network.');
  }
  return `${recipientAddress}/transfer${formatParams({ address: asset.contractAddress, value: amountBaseUnits })}`;
}
