import { NetworkType } from '@core/utils/consts';
import type { Address as Base32Address } from 'cive';
import { decodeBase32Address } from 'cive/utils';
import { formatParams, readAmount, readUri } from './params';
import type { PaymentRequest } from './types';

export function parseConfluxUri(input: string): PaymentRequest {
  const { path, params } = readUri(input);
  const parts = path.split('/');
  const [recipientAddress, method] = parts;
  if (parts.length > 2 || (method !== undefined && method !== 'transfer')) {
    throw new Error('Unsupported Conflux payment method.');
  }

  const { networkId } = decodeBase32Address({ address: recipientAddress as Base32Address });
  const contractAddress = params.get('address');
  if ((contractAddress !== null && method !== 'transfer') || (params.has('value') && params.has('uint256'))) {
    throw new Error('Conflicting Conflux payment parameters.');
  }
  if (contractAddress !== null && decodeBase32Address({ address: contractAddress as Base32Address }).networkId !== networkId) {
    throw new Error('Token and recipient must belong to the same Conflux network.');
  }

  return {
    networkType: NetworkType.Conflux,
    // Supported Core networks use the address network ID as the chain ID.
    chainId: BigInt(networkId),
    recipientAddress,
    asset: contractAddress === null ? { type: 'native' } : { type: 'erc20', contractAddress },
    amountBaseUnits: readAmount(params.get('value') ?? params.get('uint256')),
  };
}

export function encodeConfluxUri(payment: PaymentRequest): string {
  const { recipientAddress, asset, amountBaseUnits, chainId } = payment;
  const { networkId } = decodeBase32Address({ address: recipientAddress as Base32Address });
  if (chainId !== undefined && BigInt(networkId) !== chainId) {
    throw new Error('Recipient does not belong to the requested Conflux network.');
  }

  if (asset.type === 'native') return recipientAddress + formatParams({ value: amountBaseUnits });
  if (decodeBase32Address({ address: asset.contractAddress as Base32Address }).networkId !== networkId) {
    throw new Error('Token and recipient must belong to the same Conflux network.');
  }
  return `${recipientAddress}/transfer${formatParams({ address: asset.contractAddress, value: amountBaseUnits })}`;
}
