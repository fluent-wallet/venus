import { iface721, iface777, iface1155 } from '@core/contracts';
import { AssetType } from '@core/database/models/Asset';
import { type Network, NetworkType } from '@core/database/models/Network';
import type { Address as Base32Address } from 'cive';
import { base32AddressToHex } from 'cive/utils';
import Decimal from 'decimal.js';
import type { AssetInfo } from '../AssetsTracker/types';
import type { ITxEvm } from './types';

export interface TransactionBuildParams {
  asset: AssetInfo;
  amount: string;
  recipientAddress: string;
  currentAddressValue: string;
  currentNetwork: Network;
  nftTokenId?: string;
}

const convertAmountToHex = (amount: string, decimals: number): string => {
  return new Decimal(amount || 0).mul(Decimal.pow(10, decimals)).toHex();
};

const buildNativeTransfer = (params: TransactionBuildParams): ITxEvm => {
  const { amount, recipientAddress, currentAddressValue, currentNetwork, asset } = params;

  const transferAmountHex = convertAmountToHex(amount, asset.decimals || 18);

  return {
    from: currentAddressValue,
    to: recipientAddress,
    value: transferAmountHex,
    data: '0x',
    chainId: currentNetwork.chainId,
  };
};

const buildERC20Transfer = (params: TransactionBuildParams): ITxEvm => {
  const { asset, amount, recipientAddress, currentAddressValue, currentNetwork } = params;

  if (!asset.contractAddress) {
    throw new Error('ERC20 asset must have a contract address');
  }

  const transferAmountHex = convertAmountToHex(amount, asset.decimals || 18);

  const to = currentNetwork.networkType === NetworkType.Conflux ? base32AddressToHex({ address: recipientAddress as Base32Address }) : recipientAddress;

  const data = iface777.encodeFunctionData('transfer', [to, transferAmountHex]);

  return {
    from: currentAddressValue,
    to: asset.contractAddress,
    value: '0x0',
    data,
    chainId: currentNetwork.chainId,
  };
};

const buildERC721Transfer = (params: TransactionBuildParams): ITxEvm => {
  const { asset, recipientAddress, currentAddressValue, currentNetwork, nftTokenId } = params;

  if (!asset.contractAddress) {
    throw new Error('ERC721 asset must have a contract address');
  }

  if (!nftTokenId) {
    throw new Error('ERC721 transfer requires a token ID');
  }

  const from = currentNetwork.networkType === NetworkType.Conflux ? base32AddressToHex({ address: currentAddressValue as Base32Address }) : currentAddressValue;
  const to = currentNetwork.networkType === NetworkType.Conflux ? base32AddressToHex({ address: recipientAddress as Base32Address }) : recipientAddress;

  const data = iface721.encodeFunctionData('transferFrom', [from, to, nftTokenId]);

  return {
    from: currentAddressValue,
    to: asset.contractAddress,
    value: '0x0',
    data,
    chainId: currentNetwork.chainId,
  };
};

const buildERC1155Transfer = (params: TransactionBuildParams): ITxEvm => {
  const { asset, amount, recipientAddress, currentAddressValue, currentNetwork, nftTokenId } = params;

  if (!asset.contractAddress) {
    throw new Error('ERC1155 asset must have a contract address');
  }

  if (!nftTokenId) {
    throw new Error('ERC1155 transfer requires a token ID');
  }

  const from = currentNetwork.networkType === NetworkType.Conflux ? base32AddressToHex({ address: currentAddressValue as Base32Address }) : currentAddressValue;
  const to = currentNetwork.networkType === NetworkType.Conflux ? base32AddressToHex({ address: recipientAddress as Base32Address }) : recipientAddress;
  const transferAmountHex = convertAmountToHex(amount, 0);

  const data = iface1155.encodeFunctionData('safeTransferFrom', [from, to, nftTokenId, transferAmountHex, '0x']);

  return {
    from: currentAddressValue,
    to: asset.contractAddress,
    value: '0x0',
    data,
    chainId: currentNetwork.chainId,
  };
};

export const buildTransaction = (params: TransactionBuildParams): ITxEvm => {
  switch (params.asset.type) {
    case AssetType.Native:
      return buildNativeTransfer(params);
    case AssetType.ERC20:
      return buildERC20Transfer(params);
    case AssetType.ERC721:
      return buildERC721Transfer(params);
    case AssetType.ERC1155:
      return buildERC1155Transfer(params);
    default:
      throw new Error(`Unsupported asset type: ${params.asset.type}`);
  }
};
