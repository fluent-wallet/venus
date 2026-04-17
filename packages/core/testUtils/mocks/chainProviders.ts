import {
  AssetType,
  type ChainCallParams,
  type ConfluxUnsignedTransaction,
  type ConfluxUnsignedTransactionPayload,
  type EvmUnsignedTransaction,
  type EvmUnsignedTransactionPayload,
  type FungibleAssetBalanceRequest,
  type Hex,
  type IChainProvider,
  type IChainRpc,
  type ISigner,
  type SignedTransaction,
  type TransactionParams,
  type UnsignedTransaction,
} from '@core/types';

import { NetworkType } from '@core/utils/consts';

import { checksum } from 'ox/Address';

export const DEFAULT_BASE32_ADDRESS = 'cfx:aamg0ss14e0xk1r3g3anzbeh2hgbjs7xtyx9ste4re';
export const DEFAULT_BASE32_ADDRESS_TEST = 'cfxtest:aamg0ss14e0xk1r3g3anzbeh2hgbjs7xty3y79cuks';
export const DEFAULT_HEX_ADDRESS = '0x146B39d7d12d34DDB93640bA8487C1Cc143bb37d';
export const DEFAULT_PRIVATE_KEY = '0xbb598b87b7799d0042d76978adf1594311a3c4dd257da94194d963c4bdfddc54';

export const DEFAULT_TEST_NET_20_TOKEN_CONTRACT = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';
export const DEFAULT_TEST_NFT_721_CONTRACT = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';
export const DEFAULT_TEST_NET_1155_CONTRACT = 'cfxtest:acc8mtwgyrv97rf2ycvg9tee93a7gxs3ea1vb05d31';
export const createMockConfluxSdk = () => {
  const rpc = {
    getBalance: jest.fn().mockResolvedValue(0n),
    getNextNonce: jest.fn().mockResolvedValue(0n),
    getEpochNumber: jest.fn().mockResolvedValue(0n),
    getBlockByEpochNumber: jest.fn().mockResolvedValue({ baseFeePerGas: undefined }),
    estimateGasAndCollateral: jest.fn().mockResolvedValue({
      gasUsed: 21_000n,
      gasLimit: 21_000n,
      storageCollateralized: 0n,
    }),
    getGasPrice: jest.fn().mockResolvedValue(1n),
    maxPriorityFeePerGas: jest.fn().mockResolvedValue(1n),
    call: jest.fn(),
  };

  return {
    sdk: {
      cfx: rpc,
      sendRawTransaction: jest.fn().mockResolvedValue('0xhash'),
    },
    rpc,
  };
};

export const createMockConfluxUnsignedTx = (overrides: Partial<ConfluxUnsignedTransactionPayload> = {}) => ({
  chainType: NetworkType.Conflux,
  payload: {
    from: DEFAULT_BASE32_ADDRESS,
    value: '0x1',
    data: '0x',
    chainId: '0x1',
    ...overrides,
  },
});

export const createMockEthersProvider = () => {
  const provider = {
    getBalance: jest.fn().mockResolvedValue(0n),
    getTransactionCount: jest.fn().mockResolvedValue(0),
    estimateGas: jest.fn().mockResolvedValue(21_000n),
    getFeeData: jest.fn().mockResolvedValue({
      gasPrice: 1n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
    }),
    broadcastTransaction: jest.fn().mockResolvedValue({ hash: '0xhash' }),
    call: jest.fn(),
  };

  return { provider };
};

export const createMockEvmUnsignedTx = (overrides: Partial<EvmUnsignedTransactionPayload> = {}) => ({
  chainType: NetworkType.Ethereum,
  payload: {
    from: checksum(DEFAULT_HEX_ADDRESS),
    value: '0x1',
    data: '0x',
    chainId: '0x1',
    ...overrides,
  },
});

const createThrowingRpc = (): IChainRpc => {
  return {
    request: async (method: string) => {
      switch (method) {
        case 'eth_getCode':
          return '0x';
        case 'eth_estimateGas':
          return '0x5208';
        case 'cfx_checkBalanceAgainstTransaction':
          return { willPayCollateral: true, willPayTxFee: true };
        case 'cfx_epochNumber':
          return '0x0';
        default:
          throw new Error('StubChainProvider.rpc.request not implemented');
      }
    },
    batch: async () => {
      throw new Error('StubChainProvider.rpc.batch not implemented');
    },
  };
};

export class StubChainProvider implements IChainProvider {
  readonly chainId: string;
  readonly networkType: NetworkType;
  readonly rpc: IChainRpc;

  private nativeBalances = new Map<string, Hex>();
  private tokenBalances = new Map<string, Hex>();
  private customCallResponses = new Map<string, Hex>();

  constructor(opts: {
    chainId: string;
    networkType: NetworkType;
    rpc?: IChainRpc;
  }) {
    this.chainId = opts.chainId;
    this.networkType = opts.networkType;
    this.rpc = opts.rpc ?? createThrowingRpc();
  }

  setNativeBalance(address: string, balanceHex: Hex) {
    this.nativeBalances.set(address.toLowerCase(), balanceHex);
  }

  setTokenBalance(contract: string, balanceHex: Hex) {
    this.tokenBalances.set(contract.toLowerCase(), balanceHex);
  }

  setCallResponse(contract: string, data: Hex, result: Hex) {
    this.customCallResponses.set(`${contract.toLowerCase()}:${data.toLowerCase()}`, result);
  }

  deriveAddress(): string {
    throw new Error('StubChainProvider.deriveAddress not implemented');
  }

  validateAddress(): boolean {
    return true;
  }

  async buildTransaction(params: TransactionParams): Promise<UnsignedTransaction> {
    const payload: any = {
      from: params.from,
      to: params.to,
      value: '0x1',
      data: params.data ?? '0x',
      type: params.maxFeePerGas || params.maxPriorityFeePerGas ? 2 : params.gasPrice ? 0 : undefined,
      gasPrice: params.gasPrice,
      gasLimit: params.gasLimit,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      storageLimit: params.storageLimit,
      nonce: params.nonce ?? 0,
      chainId: params.chainId,
      epochHeight: params.epochHeight,
    };

    // For ERC20 we treat "to" as contract address and force value to 0
    if (params.assetType === AssetType.ERC20 && params.contractAddress) {
      payload.to = params.contractAddress;
      payload.value = '0x0';
    }

    return {
      chainType: this.networkType,
      payload,
    } as UnsignedTransaction;
  }

  async prepareUnsignedTransaction(tx: UnsignedTransaction): Promise<UnsignedTransaction> {
    const estimate = await this.estimateFee(tx);
    const payload: Record<string, unknown> = { ...tx.payload };

    payload.gasLimit = payload.gasLimit ?? estimate.gasLimit;

    if (tx.chainType === NetworkType.Ethereum) {
      const isExplicitLegacy = payload.type === 0 || payload.type === 1;
      const isExplicit1559 = payload.type === 2;
      const hasLegacyFee = payload.gasPrice !== undefined;
      const has1559Fee = payload.maxFeePerGas !== undefined || payload.maxPriorityFeePerGas !== undefined;
      const networkSupports1559 = 'maxFeePerGas' in estimate && estimate.maxFeePerGas !== undefined && estimate.maxPriorityFeePerGas !== undefined;
      const prefers1559 = isExplicit1559 || (!isExplicitLegacy && (has1559Fee || (!hasLegacyFee && networkSupports1559)));
      payload.nonce = payload.nonce ?? 0;

      if (prefers1559) {
        payload.type = payload.type ?? 2;
        payload.gasPrice = undefined;
        payload.maxFeePerGas = payload.maxFeePerGas ?? ('maxFeePerGas' in estimate ? estimate.maxFeePerGas : undefined);
        payload.maxPriorityFeePerGas = payload.maxPriorityFeePerGas ?? ('maxPriorityFeePerGas' in estimate ? estimate.maxPriorityFeePerGas : undefined);
      } else if (isExplicitLegacy || hasLegacyFee || ('gasPrice' in estimate && estimate.gasPrice)) {
        payload.type = payload.type ?? (payload.gasPrice !== undefined ? 0 : undefined);
        payload.gasPrice = payload.gasPrice ?? ('gasPrice' in estimate ? estimate.gasPrice : undefined);
        payload.maxFeePerGas = undefined;
        payload.maxPriorityFeePerGas = undefined;
      }
    }

    if (tx.chainType === NetworkType.Conflux) {
      const isExplicitLegacy = payload.type === 0 || payload.type === 1;
      const isExplicit1559 = payload.type === 2;
      const hasLegacyFee = payload.gasPrice !== undefined;
      const has1559Fee = payload.maxFeePerGas !== undefined || payload.maxPriorityFeePerGas !== undefined;
      const networkSupports1559 = 'maxFeePerGas' in estimate && estimate.maxFeePerGas !== undefined && estimate.maxPriorityFeePerGas !== undefined;
      const prefers1559 = isExplicit1559 || (!isExplicitLegacy && (has1559Fee || (!hasLegacyFee && networkSupports1559)));

      if (prefers1559) {
        payload.type = payload.type ?? 2;
        payload.gasPrice = undefined;
        payload.maxFeePerGas = payload.maxFeePerGas ?? ('maxFeePerGas' in estimate ? estimate.maxFeePerGas : undefined);
        payload.maxPriorityFeePerGas = payload.maxPriorityFeePerGas ?? ('maxPriorityFeePerGas' in estimate ? estimate.maxPriorityFeePerGas : undefined);
      } else {
        payload.type = payload.type ?? (payload.gasPrice !== undefined ? 0 : undefined);
        payload.gasPrice = payload.gasPrice ?? ('gasPrice' in estimate ? estimate.gasPrice : undefined);
        payload.maxFeePerGas = undefined;
        payload.maxPriorityFeePerGas = undefined;
      }

      payload.storageLimit = payload.storageLimit ?? ('storageLimit' in estimate ? estimate.storageLimit : undefined);
      payload.nonce = payload.nonce ?? 0;
      if (payload.epochHeight == null) {
        try {
          const epoch = await this.rpc.request<string>('cfx_epochNumber', ['latest_state']);
          payload.epochHeight = Number(BigInt(epoch));
        } catch {
          payload.epochHeight = 0;
        }
      }
    }

    return {
      ...tx,
      payload,
    } as UnsignedTransaction;
  }

  async estimateFee(tx: UnsignedTransaction): Promise<any> {
    if (tx.chainType === NetworkType.Conflux) {
      return {
        chainType: tx.chainType,
        gasLimit: '0x5208',
        gasPrice: '0x1',
        storageLimit: '0x0',
      };
    }

    return {
      chainType: tx.chainType,
      gasLimit: '0x5208',
      gasPrice: '0x1',
    };
  }

  async signTransaction(tx: UnsignedTransaction, signer: ISigner): Promise<SignedTransaction> {
    if (signer.type === 'hardware') {
      const typedTx = tx as ConfluxUnsignedTransaction | EvmUnsignedTransaction;
      await signer.signWithHardware({
        derivationPath: signer.getDerivationPath(),
        chainType: this.networkType,
        payload: {
          payloadKind: 'transaction',
          chainType: this.networkType,
          unsignedTx: typedTx.payload,
        },
      });
    }

    return {
      chainType: tx.chainType,
      rawTransaction: '0xraw',
      hash: '0xhash',
    } as SignedTransaction;
  }
  async broadcastTransaction(signedTx: SignedTransaction): Promise<Hex> {
    return signedTx.hash;
  }

  async getBalance(address: string): Promise<Hex> {
    return this.nativeBalances.get(address.toLowerCase()) ?? '0x0';
  }

  async getNonce(): Promise<number> {
    return 0;
  }

  async call(params: ChainCallParams): Promise<Hex> {
    if (params.data.startsWith('0x70a08231')) {
      return this.tokenBalances.get(params.to.toLowerCase()) ?? '0x0';
    }
    const key = `${params.to.toLowerCase()}:${params.data.toLowerCase()}`;
    return this.customCallResponses.get(key) ?? '0x0';
  }

  async batchCall(params: readonly ChainCallParams[]): Promise<Hex[]> {
    return Promise.all(params.map((param) => this.call(param)));
  }

  async readFungibleAssetBalances(address: string, requests: readonly FungibleAssetBalanceRequest[]): Promise<ReadonlyArray<Hex | null>> {
    return requests.map((request) => {
      if (request.assetType === AssetType.Native) {
        return this.nativeBalances.get(address.toLowerCase()) ?? '0x0';
      }

      return this.tokenBalances.get(request.contractAddress.toLowerCase()) ?? '0x0';
    });
  }

  async signMessage(): Promise<string> {
    return '0x';
  }

  verifyMessage(): boolean {
    return true;
  }
}
