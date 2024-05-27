import { AssetType } from '@core/database/models/Asset';
import { Interface, MaxUint256 } from 'ethers';

type AIBMethodSighashMapType = {
  [key: string]: { functionName: string; readableABI: string; assetType?: AssetType };
};

const abi721methodSighash: AIBMethodSighashMapType = {
  '0x095ea7b3': {
    functionName: 'approve',
    readableABI: 'function approve(address to, uint256 tokenId)',
  },

  '0x70a08231': {
    functionName: 'balanceOf',
    readableABI: 'function balanceOf(address owner) view returns (uint256)',
  },

  '0x081812fc': {
    functionName: 'getApproved',
    readableABI: 'function getApproved(uint256 tokenId) view returns (address)',
  },

  '0xe985e9c5': {
    functionName: 'isApprovedForAll',
    readableABI: 'function isApprovedForAll(address owner, address operator) view returns (bool)',
  },

  '0x06fdde03': {
    functionName: 'name',
    readableABI: 'function name() view returns (string)',
  },

  '0x6352211e': {
    functionName: 'ownerOf',
    readableABI: 'function ownerOf(uint256 tokenId) view returns (address)',
  },

  '0x42842e0e': {
    functionName: 'safeTransferFrom',
    readableABI: 'function safeTransferFrom(address from, address to, uint256 tokenId)',
  },

  '0xb88d4fde': {
    functionName: 'safeTransferFrom',
    readableABI: 'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
  },

  '0xa22cb465': {
    functionName: 'setApprovalForAll',
    readableABI: 'function setApprovalForAll(address operator, bool approved)',
  },

  '0x01ffc9a7': {
    functionName: 'supportsInterface',
    readableABI: 'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  },

  '0x95d89b41': {
    functionName: 'symbol',
    readableABI: 'function symbol() view returns (string)',
  },

  '0xc87b56dd': {
    functionName: 'tokenURI',
    readableABI: 'function tokenURI(uint256 tokenId) view returns (string)',
  },

  '0x23b872dd': {
    functionName: 'transferFrom',
    readableABI: 'function transferFrom(address from, address to, uint256 tokenId)',
  },
};

const abi1155methodSighash: AIBMethodSighashMapType = {
  '0x00fdd58e': {
    functionName: 'balanceOf',
    readableABI: 'function balanceOf(address account, uint256 id) view returns (uint256)',
  },

  '0x4e1273f4': {
    functionName: 'balanceOfBatch',
    readableABI: 'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  },

  '0xe985e9c5': {
    functionName: 'isApprovedForAll',
    readableABI: 'function isApprovedForAll(address account, address operator) view returns (bool)',
  },

  '0x2eb2c2d6': {
    functionName: 'safeBatchTransferFrom',
    readableABI: 'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] values, bytes data)',
  },

  '0xf242432a': {
    functionName: 'safeTransferFrom',
    readableABI: 'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
  },

  '0xa22cb465': {
    functionName: 'setApprovalForAll',
    readableABI: 'function setApprovalForAll(address operator, bool approved)',
  },

  '0x01ffc9a7': {
    functionName: 'supportsInterface',
    readableABI: 'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  },

  '0x0e89341c': {
    functionName: 'uri',
    readableABI: 'function uri(uint256) view returns (string)',
  },
};

const abi20methodSighash: AIBMethodSighashMapType = {
  '0x70a08231': {
    functionName: 'balanceOf',
    readableABI: 'function balanceOf(address tokenHolder) view returns (uint256)',
  },

  '0x313ce567': {
    functionName: 'decimals',
    readableABI: 'function decimals() pure returns (uint8)',
  },

  '0x06fdde03': {
    functionName: 'name',
    readableABI: 'function name() view returns (string)',
  },

  '0x95d89b41': {
    functionName: 'symbol',
    readableABI: 'function symbol() view returns (string)',
  },

  '0xa9059cbb': {
    functionName: 'transfer',
    readableABI: 'function transfer(address recipient, uint256 amount) returns (bool)',
  },

  '0xdd62ed3e': {
    functionName: 'allowance',
    readableABI: 'function allowance(address holder, address spender) view returns (uint256)',
  },

  '0x095ea7b3': {
    functionName: 'approve',
    readableABI: 'function approve(address spender, uint256 value) returns (bool)',
    assetType: AssetType.ERC20,
  },

  '0x556f0dc7': {
    functionName: 'granularity',
    readableABI: 'function granularity() view returns (uint256)',
  },

  '0x9bd9bbc6': {
    functionName: 'send',
    readableABI: 'function send(address recipient, uint256 amount, bytes data)',
  },

  '0x23b872dd': {
    functionName: 'transferFrom',
    readableABI: 'function transferFrom(address holder, address recipient, uint256 amount) returns (bool)',
  },
};

type ParseTxDataParameters = {
  data?: string;
  to?: string;
};

export interface FunctionNameGeneric {
  functionName: string;
  readableABI: string;
  assetType?: AssetType;
}
export interface FunctionNameUnknown {
  functionName: 'unknown' | 'Contract Create';
  readableABI: string;
  assetType?: AssetType;
}
export interface FunctionNameApprove {
  functionName: 'approve';
  address: string;
  value: bigint;
  readableABI: string;
  isUnlimited: boolean;
  assetType?: AssetType;
}

export type ParseTxDataReturnType = FunctionNameGeneric | FunctionNameUnknown | FunctionNameApprove;

export function parseTxData({ data, to }: ParseTxDataParameters): ParseTxDataReturnType {
  if (!to) {
    return {
      functionName: 'Contract Create',
      readableABI: '',
    };
  }

  if (!data) {
    return {
      functionName: 'unknown' as const,
      readableABI: '',
    };
  }

  const methodId = data.slice(0, 10); // 0x.....

  const nameAndABI = abi20methodSighash[methodId] || abi1155methodSighash[methodId] || abi721methodSighash[methodId];

  if (nameAndABI) {
    switch (nameAndABI.functionName) {
      case 'approve': {
        const fn = new Interface([nameAndABI.readableABI]);
        const result = fn.decodeFunctionData(nameAndABI.functionName, data);
        const [address, value] = result as unknown as [string, bigint];
        return {
          functionName: 'approve',
          address,
          value,
          readableABI: nameAndABI.readableABI,
          isUnlimited: value === MaxUint256,
          assetType: nameAndABI.assetType,
        };
      }
      default:
        return { functionName: nameAndABI.functionName, readableABI: nameAndABI.readableABI };
    }
  }

  return {
    functionName: 'unknown' as const,
    readableABI: '',
  };
}

export function isApproveMethod(args: ParseTxDataReturnType): args is FunctionNameApprove {
  return args.functionName === 'approve';
}
