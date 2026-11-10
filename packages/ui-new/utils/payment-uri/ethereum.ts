import { NetworkType } from '@core/utils/consts';
import { isAddress } from 'ethers';
import { formatParams, readAmount, readUri } from './params';
import type { PaymentRequest } from './types';

export function parseEthereumUri(input: string): PaymentRequest {
  const { path, params } = readUri(input);
  const match = /^([^/@]+)(?:@([^/]+))?(?:\/([^/]+))?$/.exec(path);
  if (!match) throw new Error('Invalid Ethereum payment path.');

  const [, target, chainIdText, method] = match;
  const targetAddress = target.replace(/^pay-/i, '');
  if (!isAddress(targetAddress)) throw new Error('Invalid Ethereum target address.');
  if (method !== undefined && method !== 'transfer') throw new Error('Unsupported Ethereum payment method.');

  let chainId: bigint | undefined;
  if (chainIdText !== undefined) {
    // Read legacy hex IDs; new payment URIs always write decimal IDs.
    if (!/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(chainIdText)) throw new Error('Invalid Ethereum chain ID.');
    chainId = BigInt(chainIdText);
  }

  const amountText = params.get(method === 'transfer' ? 'uint256' : 'value');
  if (amountText !== null && !/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(amountText)) {
    throw new Error('Ethereum payment amounts must use decimal notation.');
  }
  const amountBaseUnits = readAmount(amountText);

  if (method === undefined) {
    if (params.has('address') || params.has('uint256')) throw new Error('Unexpected token payment parameters.');
    return { networkType: NetworkType.Ethereum, chainId, recipientAddress: targetAddress, asset: { type: 'native' }, amountBaseUnits };
  }

  const recipientAddress = params.get('address');
  if (!recipientAddress || !isAddress(recipientAddress) || params.has('value')) {
    throw new Error('Invalid ERC20 payment parameters.');
  }
  return {
    networkType: NetworkType.Ethereum,
    chainId,
    recipientAddress,
    asset: { type: 'erc20', contractAddress: targetAddress },
    amountBaseUnits,
  };
}

export function encodeEthereumUri(payment: PaymentRequest): string {
  const { recipientAddress, asset, amountBaseUnits, chainId } = payment;
  if (!isAddress(recipientAddress)) throw new Error('Invalid Ethereum recipient address.');
  if (chainId !== undefined && chainId < 0n) {
    throw new Error('Ethereum chain ID must be a non-negative integer.');
  }

  const network = chainId === undefined ? '' : `@${chainId}`;
  if (asset.type === 'native') return `ethereum:${recipientAddress}${network}${formatParams({ value: amountBaseUnits })}`;
  if (!isAddress(asset.contractAddress)) throw new Error('Invalid ERC20 contract address.');
  return `ethereum:${asset.contractAddress}${network}/transfer${formatParams({ address: recipientAddress, uint256: amountBaseUnits })}`;
}
