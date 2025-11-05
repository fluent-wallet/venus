import type { Address, Hex } from '@core/types';
import { AssetType } from '@core/types';
import { iface777, iface721, iface1155 } from '@core/contracts';
import * as OxValue from 'ox/Value';
import * as OxHex from 'ox/Hex';

import { convertBase32ToHex, decode, type Base32Address } from '@core/utils/address';

const isBase32Address = (value: Address): value is Base32Address => {
  try {
    decode(value);
    return true;
  } catch {
    return false;
  }
};
export interface TransactionBuildInput {
  from: Address;
  to: Address;
  amount: string;
  assetType: AssetType;
  assetDecimals: number;
  chainId: string;
  contractAddress?: Address;
  nftTokenId?: string;
}

export interface EvmTransactionPayload {
  from: Address;
  to: Address;
  value: Hex;
  data: Hex;
  chainId: string;
}

const normalizeAddressForCalldata = (value: Address): Address => {
  return isBase32Address(value) ? convertBase32ToHex(value) : value;
};
export const buildNativeTransfer = (input: TransactionBuildInput): EvmTransactionPayload => {
  const { from, to, amount, assetDecimals, chainId } = input;
  const quantity = OxValue.from(amount, assetDecimals);

  return {
    from: from,
    to: to,
    chainId,
    value: OxHex.fromNumber(quantity),
    data: '0x',
  };
};

export const buildERC20Transfer = (input: TransactionBuildInput): EvmTransactionPayload => {
  const { from, to, amount, assetDecimals, chainId, contractAddress } = input;

  if (!contractAddress) throw new Error('ERC20 transfer requires contractAddress');

  const quantity = OxValue.from(amount, assetDecimals);
  const data = iface777.encodeFunctionData('transfer', [normalizeAddressForCalldata(to), quantity]) as Hex;

  return {
    from,
    to: contractAddress,
    chainId,
    value: '0x0',
    data,
  };
};

export const buildERC721Transfer = (input: TransactionBuildInput): EvmTransactionPayload => {
  const { from, to, chainId, contractAddress, nftTokenId } = input;

  if (!contractAddress) throw new Error('ERC721 transfer requires contractAddress');
  if (!nftTokenId) throw new Error('ERC721 transfer requires nftTokenId');

  const tokenId = BigInt(nftTokenId);
  const data = iface721.encodeFunctionData('transferFrom', [normalizeAddressForCalldata(from), normalizeAddressForCalldata(to), tokenId]) as Hex;

  return {
    from,
    to: contractAddress,
    chainId,
    value: '0x0',
    data,
  };
};

export const buildERC1155Transfer = (input: TransactionBuildInput): EvmTransactionPayload => {
  const { from, to, amount, chainId, contractAddress, nftTokenId } = input;

  if (!contractAddress) throw new Error('ERC1155 transfer requires contractAddress');
  if (!nftTokenId) throw new Error('ERC1155 transfer requires nftTokenId');

  const tokenId = BigInt(nftTokenId);
  const quantity = OxValue.from(amount, 0);
  const data = iface1155.encodeFunctionData('safeTransferFrom', [
    normalizeAddressForCalldata(from),
    normalizeAddressForCalldata(to),
    tokenId,
    quantity,
    '0x',
  ]) as Hex;

  return {
    from,
    to: contractAddress,
    chainId,
    value: '0x0',
    data,
  };
};

export const buildTransactionPayload = (input: TransactionBuildInput): EvmTransactionPayload => {
  switch (input.assetType) {
    case AssetType.Native:
      return buildNativeTransfer(input);
    case AssetType.ERC20:
      return buildERC20Transfer(input);
    case AssetType.ERC721:
      return buildERC721Transfer(input);
    case AssetType.ERC1155:
      return buildERC1155Transfer(input);
    default:
      throw new Error(`Unsupported asset type: ${input.assetType}`);
  }
};
