import { JsonRpcProvider, getBigInt, Transaction, Wallet, Signer, TransactionResponse } from 'ethers';
import { Network, NetworkType } from '@core/database/models/Network';
import { HexStringType, ITxEvm } from './types';
import { createPublicClient, http, isAddress, hexToBigInt, encodeFunctionData as viemEncodeFunctionData, type Abi, type BlockTag } from 'viem';
import { confluxESpace, confluxESpaceTestnet } from 'viem/chains';
import { chain } from 'lodash-es';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';

export class EVMTransactionPlugin {
  private JsonProvider: ReturnType<typeof createPublicClient>;

  private chainId: string;

  constructor(network: Network) {
    let chain: typeof confluxESpace | typeof confluxESpaceTestnet = confluxESpace;
    if (network.chainId === CFX_ESPACE_TESTNET_CHAINID) {
      chain = confluxESpaceTestnet;
    } else if (network.networkType !== NetworkType.Ethereum) {
      chain = confluxESpace;
    } else {
      throw new Error('EVMTransaction Plugin Unsupported network chianId');
    }

    this.JsonProvider = createPublicClient({
      batch: {
        multicall: true,
      },
      chain: chain,
      transport: http(network.endpoint),
    });
    this.chainId = network.chainId;
  }
  addHexPrefix = (str: string): HexStringType => {
    if (str.startsWith('0x')) {
      return str as HexStringType;
    }
    return `0x${str}`;
  };

  validateAddress(address: string): boolean {
    return isAddress(address);
  }

  async getBalance(request: { address: string; tokenAddress?: string }): Promise<bigint> {
    const { address, tokenAddress } = request;
    if (tokenAddress) {
      // 0x70a08231000000000000000000000000 is the method signature for balanceOf(address)
      const result = await this.JsonProvider.request({
        method: 'eth_call',
        params: [
          {
            to: '0x89c3d85389b8841215696a91dbf24efe7b0a62e1',
            data: `0x70a08231000000000000000000000000${(address.startsWith('0x') ? address.slice(2) : address).toLowerCase()}`,
          },
        ],
      });
      return hexToBigInt(result);
    } else {
      return this.JsonProvider.getBalance({ address: this.addHexPrefix(address) });
    }
  }

  async isContractAddress(address: string): Promise<boolean> {
    const code = await this.JsonProvider.getBytecode({ address: this.addHexPrefix(address) }); // return  hex or undefined
    return !!code;
  }

  async fetchGasPrice(): Promise<bigint> {
    const price = await this.JsonProvider.getGasPrice();
    return price;
  }

  async fetchFeeInfo(tx: ITxEvm): Promise<{ gasPrice: bigint; gas: bigint }> {
    const isContract = await this.isContractAddress(tx.to);
    const isSendNativeToken = (!isContract && !!tx.to) || !tx.data || tx.data === '0x';
    const gasPrice = await this.fetchGasPrice();
    if (isSendNativeToken) {
      return { gasPrice: gasPrice, gas: 21000n };
    }

    const gas = await this.JsonProvider.estimateGas({
      account: this.addHexPrefix(tx.from),
      to: this.addHexPrefix(tx.to),
      value: tx.value,
      data: tx.data ? this.addHexPrefix(tx.data) : undefined,
    });

    return { gasPrice: gasPrice, gas: gas };
  }

  async getTransactionCount(address: string, blockTag: BlockTag = 'pending') {
    return this.JsonProvider.getTransactionCount({ address: this.addHexPrefix(address), blockTag });
  }

  async encodeFunctionData(args: Parameters<typeof viemEncodeFunctionData>[0]) {
    return viemEncodeFunctionData(args);
  }

  async broadcastTransaction(encode: HexStringType) {
    return this.JsonProvider.sendRawTransaction({ serializedTransaction: encode });
  }

  async getSigner(privateKey: string): Promise<Signer> {
    const wallet = new Wallet(privateKey);
    return wallet;
  }
}
