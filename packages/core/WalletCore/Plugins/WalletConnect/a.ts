import { convertBase32ToHex, convertHexToBase32, type Base32Address } from '@cfx-kit/dapp-utils/dist/address';
import type { ProposalTypes } from '@walletconnect/types';

export interface Namespace {
  chains: string[];
  methods: string[];
  events: string[];
  accounts?: string[];
}

export enum ChainPrefix {
  EIP = 'eip155',
  CIP = 'cip155',
}

export const CIPPlaceHolder = '201029';

const regex = /^(cip155|eip155):(\d+)(?::([0-9a-zA-Z:]+))?$/;
export const parseNamespaceData = (data: string) => {
  const match = data.match(regex);

  if (match) {
    return {
      chainPrefix: match[1],
      chainId: match[2],
      address: match[3],
    };
  }

  // 如果匹配失败，抛出错误
  throw new Error(`Invalid data: ${data}`);
};

export const formatChainId = (chainId: string) => {
  if (chainId.startsWith(`${ChainPrefix.EIP}`) || chainId.startsWith(`${ChainPrefix.CIP}`)) {
    if (chainId.startsWith(ChainPrefix.CIP)) {
      return chainId.replace(`${ChainPrefix.CIP}:`, `${ChainPrefix.EIP}:${CIPPlaceHolder}`);
    }
    return chainId;
  }

  if (Number.isNaN(Number(chainId))) {
    throw new Error('Invalid chainId');
  }

  return `${ChainPrefix.EIP}:${chainId}`;
};

export const convertEipDataToCip = (data: string) => {
  // "eip155:2010291:0xDeaA5029e4341e6357E9CF89ddBF7e16Ce3F0169"; -> cip:1:cfxtest:xxxx;
  const { chainPrefix, chainId, address: hexAddress } = parseNamespaceData(data);
  if (chainPrefix !== ChainPrefix.EIP && chainPrefix !== ChainPrefix.CIP) {
    throw new Error('Invalid Receive data');
  }
  if (chainPrefix === ChainPrefix.EIP && chainId.startsWith(CIPPlaceHolder)) {
    const cipChainId = chainId.slice(CIPPlaceHolder.length);
    console.log('cipChainId', cipChainId, hexAddress ? hexAddress : '', hexAddress ? convertHexToBase32(hexAddress, cipChainId) : '');
    return `${ChainPrefix.CIP}:${cipChainId}${hexAddress ? `:${convertHexToBase32(hexAddress, cipChainId)}` : ''}`;
  }

  return data;
};
export const convertCipDataToEip = (data: string) => {
  // "cip:1:cfxtest:xxxx;" -> "eip155:2010291:0xDeaA5029e4341e6357E9CF89ddBF7e16Ce3F0169";
  const { chainPrefix, chainId, address: base32Address } = parseNamespaceData(data);
  if (chainPrefix !== ChainPrefix.EIP && chainPrefix !== ChainPrefix.CIP) {
    throw new Error('Invalid Receive data');
  }
  if (chainPrefix === ChainPrefix.CIP) {
    return `${ChainPrefix.EIP}:${CIPPlaceHolder}${chainId}${base32Address ? `:${convertBase32ToHex(base32Address as Base32Address)}` : ''}`;
  }

  return data;
};

export const convertEipMethodToCip = (method: string) => {
  if (method.startsWith('eth_')) {
    return `cfx_${method.slice(4)}`;
  }
  return method;
};
export const convertCipMethodToEip = (method: string) => {
  if (method.startsWith('cfx_')) {
    return `eth_${method.slice(4)}`;
  }
  return method;
};

export const isCIPData = (data: string) => data.startsWith(`${ChainPrefix.EIP}:${CIPPlaceHolder}`);

export const ExtractCip155Namespace = (namespaces: Record<ChainPrefix, Namespace>) => {
  const hasCIPData = namespaces[ChainPrefix.EIP]?.chains?.some?.(isCIPData);
  if (!hasCIPData) {
    return namespaces;
  }
  const cip155 = {
    chains: namespaces[ChainPrefix.EIP].chains?.filter?.(isCIPData).map(convertEipDataToCip),
    accounts: namespaces[ChainPrefix.EIP].accounts?.filter?.(isCIPData).map(convertEipDataToCip),
    events: namespaces[ChainPrefix.EIP].events,
    methods: namespaces[ChainPrefix.EIP].methods?.map(convertEipMethodToCip),
  };
  const eip155 =
    cip155.chains?.length === namespaces[ChainPrefix.EIP].chains?.length
      ? null
      : {
          accounts: namespaces[ChainPrefix.EIP].accounts?.filter?.((account) => !isCIPData(account)),
          chains: namespaces[ChainPrefix.EIP].chains?.filter?.((chain) => !isCIPData(chain)),
          events: namespaces[ChainPrefix.EIP].events,
          methods: namespaces[ChainPrefix.EIP].methods,
        };
  const result: ProposalTypes.RequiredNamespaces | ProposalTypes.OptionalNamespaces = {
    ...namespaces,
    cip155,
    ...(eip155 ? { eip155 } : {}),
  };
  if (!eip155) {
    // biome-ignore lint/performance/noDelete: <explanation>
    delete result.eip155;
  }
  return result;
};

export const mergeCIPNamespaceToEIP = (_eipNamespace: Namespace, cipNamespace?: Namespace | null) => {
  let eipNamespace = _eipNamespace;
  if (!_eipNamespace) {
    eipNamespace = {} as Namespace;
  }

  if (!cipNamespace) {
    return eipNamespace;
  }

  eipNamespace.chains = [...new Set((eipNamespace.chains ?? []).concat(cipNamespace.chains ? cipNamespace.chains.map?.(convertCipDataToEip) : []))];
  eipNamespace.accounts = [...new Set((eipNamespace.accounts ?? []).concat(cipNamespace.accounts ? cipNamespace.accounts.map?.(convertCipDataToEip) : []))];
  eipNamespace.methods = [...new Set((eipNamespace.methods ?? []).concat(cipNamespace.methods ? cipNamespace.methods.map?.(convertCipMethodToEip) : []))];
  eipNamespace.events = [...new Set((eipNamespace.events ?? []).concat(cipNamespace.events ?? []))];
  return eipNamespace;
};
