import { HttpJsonRpcClient } from '@core/rpc';
import { Interface, getAddress as toChecksumAddress } from 'ethers';
import ky from 'ky';
import { catchError, concatMap, EMPTY, from, lastValueFrom, map } from 'rxjs';
import ESpaceWalletABI from '../../../../contracts/ABI/ESpaceWallet';
import { AssetType } from '../../../../database/models/Asset';
import { ChainType, type Network } from './../../../../database/models/Network/index';
import { Networks } from '../../../../utils/consts';
import type { AssetInfo } from '../types';

const walletInterface = new Interface(ESpaceWalletABI);
export const eSpaceTestnetServer = ky.create({ prefixUrl: Networks['eSpace Testnet'].scanOpenAPI });
export const eSpaceServer = ky.create({ prefixUrl: Networks['Conflux eSpace'].scanOpenAPI });

interface AssetInfoFromScan {
  type: Omit<AssetType, AssetType.Native> & 'native';
  contract: string;
  priceInUSDT?: string;
  iconUrl?: string;
}

type WalletAsset = { token: readonly [string, string, string, bigint]; balance: bigint };

export const fetchESpaceServer = async ({
  hexAddress,
  assetType,
  chainType,
  network,
}: {
  hexAddress: string;
  assetType?: AssetType;
  chainType: ChainType;
  network: Network;
}): Promise<Array<AssetInfo>> => {
  const server = chainType === ChainType.Mainnet ? eSpaceServer : eSpaceTestnetServer;
  const walletContractAddress = chainType === ChainType.Mainnet ? '0x2c7e015328f37f00f9b16e4adc9cedb1f8742069' : '0xce2104aa7233b27b0ba2e98ede59b6f78c06ae05';
  const rpc = new HttpJsonRpcClient(network.endpoint);

  const fetchFromScan = () => {
    const scanInfoMap: Record<string, { type: AssetType; priceInUSDT?: string; icon?: string }> = Object.create(null);
    return from(
      server
        .get(`account/tokens?account=${hexAddress}${assetType ? `&tokenType=${assetType}` : ''}`)
        .json<{ message: string; status: '0' | '1'; result?: { list: Array<AssetInfoFromScan> } }>(),
    ).pipe(
      concatMap((scanRes) => {
        if (scanRes?.status === '1') {
          if (Array.isArray(scanRes?.result?.list)) {
            const scanResList = scanRes?.result?.list;
            scanResList.forEach((asset) => {
              const contractAddress = asset.contract ? toChecksumAddress(asset.contract) : AssetType.Native;
              const type = asset.type === 'native' ? AssetType.Native : asset.type;
              scanInfoMap[contractAddress] = { type, priceInUSDT: asset.priceInUSDT, icon: asset.iconUrl };
            });

            return from(
              rpc.batch<string>([
                {
                  method: 'eth_getBalance',
                  params: [hexAddress, 'latest'],
                },
                {
                  method: 'eth_call',
                  params: [
                    {
                      to: walletContractAddress,
                      data: walletInterface.encodeFunctionData('assetsOf', [
                        hexAddress as `0x${string}`,
                        scanRes?.result?.list?.filter((asset) => !!asset.contract)?.map((asset) => asset.contract) as Array<`0x${string}`>,
                      ]),
                    },
                    'latest',
                  ],
                },
              ]),
            ).pipe(
              map(([cfxBalance, assetsData]) => {
                const assets = Array.from<WalletAsset>(walletInterface.decodeFunctionResult('assetsOf', assetsData)[0]).map((asset) => {
                  const info = asset.token;
                  const contractAddress = toChecksumAddress(info[0]);
                  const scanInfo = scanInfoMap[contractAddress];

                  return {
                    contractAddress,
                    name: info[1],
                    symbol: info[2],
                    decimals: Number(info[3]),
                    balance: String(asset.balance),
                    ...scanInfo,
                  };
                });
                const assetsWithCFX = [
                  {
                    name: 'CFX',
                    symbol: 'CFX',
                    decimals: 18,
                    balance: cfxBalance,
                    ...scanInfoMap[AssetType.Native],
                    type: AssetType.Native,
                  },
                  ...assets.filter((asset) => asset.contractAddress !== '0x0000000000000000000000000000000000000000'),
                ];
                return assetsWithCFX as AssetInfo[];
              }),
            );
          } else {
            return [];
          }
        } else {
          if (scanRes?.message?.includes('The parameter is wrong, please confirm it is correct')) {
            return [];
          } else {
            throw new Error(scanRes.message || 'unknown scan error');
          }
        }
      }),
    );
  };

  const fetchFromChain = () => {
    return from(
      rpc.batch<string>([
        {
          method: 'eth_getBalance',
          params: [hexAddress, 'latest'],
        },
        {
          method: 'eth_call',
          params: [
            {
              to: walletContractAddress,
              data: walletInterface.encodeFunctionData('assets', [hexAddress as `0x${string}`, 20n, 0n, 100n]),
            },
            'latest',
          ],
        },
      ]),
    ).pipe(
      map(([cfxBalance, assetsData]) => {
        const assets = Array.from<WalletAsset>(walletInterface.decodeFunctionResult('assets', assetsData)[1]).map((asset) => {
          const info = asset.token;
          const contractAddress = toChecksumAddress(info[0]);

          return {
            type: AssetType.ERC20,
            contractAddress,
            name: info[1],
            symbol: info[2],
            decimals: Number(info[3]),
            balance: String(asset.balance),
          };
        });
        const assetsWithCFX = [
          {
            type: AssetType.Native,
            name: 'CFX',
            symbol: 'CFX',
            decimals: 18,
            balance: cfxBalance,
          },
          ...assets,
        ];
        return assetsWithCFX as AssetInfo[];
      }),
    );
  };

  return await lastValueFrom(
    fetchFromScan()
      .pipe(catchError(() => fetchFromChain()))
      .pipe(
        catchError((err) => {
          return EMPTY;
        }),
      ),
  );
};
