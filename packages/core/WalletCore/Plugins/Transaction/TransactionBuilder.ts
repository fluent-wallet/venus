import Decimal from 'decimal.js';
import { createERC20Contract, createERC721Contract, createERC1155Contract } from '@cfx-kit/dapp-utils/dist/contract';
import { convertBase32ToHex, type Base32Address } from '@core/utils/address';
import { AssetType } from '@core/database/models/Asset';
import { NetworkType, type Network } from '@core/database/models/Network';
import type { ITxEvm } from './types';
import type { AssetInfo } from '../AssetsTracker/types';

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

  const contract = createERC20Contract(asset.contractAddress);
  const transferAmountHex = convertAmountToHex(amount, asset.decimals || 18);

  const to = currentNetwork.networkType === NetworkType.Conflux ? convertBase32ToHex(recipientAddress as Base32Address) : recipientAddress;

  const data = contract.encodeFunctionData('transfer', [to as `0x${string}`, transferAmountHex as unknown as bigint]);

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

  const contract = createERC721Contract(asset.contractAddress);

  const data = contract.encodeFunctionData('transferFrom', [
    currentAddressValue as `0x${string}`,
    recipientAddress as `0x${string}`,
    nftTokenId as unknown as bigint,
  ]);

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

  const contract = createERC1155Contract(asset.contractAddress);
  const transferAmountHex = convertAmountToHex(amount, 0);

  const data = contract.encodeFunctionData('safeTransferFrom', [
    currentAddressValue as `0x${string}`,
    recipientAddress as `0x${string}`,
    nftTokenId as unknown as bigint,
    transferAmountHex as unknown as bigint,
    '0x',
  ]);

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
