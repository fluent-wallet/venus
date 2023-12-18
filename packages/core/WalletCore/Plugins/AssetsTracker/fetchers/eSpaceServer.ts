import { lastValueFrom, from, concatMap, map, catchError, EMPTY, tap } from 'rxjs';
import { createFetchServer, fetchChainBatch } from '@cfx-kit/dapp-utils/dist/fetch';
import { createContract } from '@cfx-kit/dapp-utils/dist/contract';
import { getAddress as toChecksumAddress } from 'ethers';
import ESpaceWalletABI from '../../../../contracts/ABI/ESpaceWallet';
import { ChainType, type Network } from './../../../../database/models/Network/index';
import { AssetType } from '../../../../database/models/Asset';
import { type AssetInfo } from '../types';


const eSpaceWalletContract = createContract({ address: '0xce2104aa7233b27b0ba2e98ede59b6f78c06ae05', ABI: ESpaceWalletABI });
const eSpaceTestnetWalletContract = createContract({ address: '0xce2104aa7233b27b0ba2e98ede59b6f78c06ae05', ABI: ESpaceWalletABI });
const eSpaceTestnetServerFetcher = createFetchServer({ prefixUrl: 'https://evmapi-testnet.confluxscan.io' });
const eSpaceServerFetcher = createFetchServer({ prefixUrl: 'https://evmapi.confluxscan.io' });

interface AssetInfoFromScan {
  type: Omit<AssetType, AssetType.Native> & 'native';
  contract: string;
  priceInUSDT?: string;
  iconUrl?: string;
}

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
  const serverFetcher = chainType === ChainType.Mainnet ? eSpaceServerFetcher : eSpaceTestnetServerFetcher;
  const walletContract = chainType === ChainType.Mainnet ? eSpaceWalletContract : eSpaceTestnetWalletContract;

  const fetchFromScan = () => {
    const scanInfoMap: Record<string, { type: AssetType; priceInUSDT?: string; icon?: string }> = Object.create(null);
    return from(
      serverFetcher.fetchServer<{ message: string; status: '0' | '1'; result?: { list: Array<AssetInfoFromScan> } }>({
        key: `eSpaceAssetsFromScan-${hexAddress}-${network.chainId}`,
        url: `account/tokens?account=${hexAddress}${assetType ? `&tokenType=${assetType}` : ''}`,
        options: {
          retry: 2,
        },
      })
    ).pipe(
      concatMap((scanRes) => {
        if (typeof scanRes?.status === 'string') {
          if (Array.isArray(scanRes?.result?.list)) {
            const scanResList = scanRes?.result?.list;
            scanResList.forEach((asset) => {
              const contractAddress = asset.contract ? toChecksumAddress(asset.contract) : AssetType.Native;
              const type = asset.type === 'native' ? AssetType.Native : asset.type;
              scanInfoMap[contractAddress] = { type, priceInUSDT: asset.priceInUSDT, icon: asset.iconUrl };
            });

            return from(
              fetchChainBatch<[string, string]>({
                key: `${network.name}|${network.chainId}|${hexAddress}`,
                url: network.endpoint,
                rpcs: [
                  {
                    method: 'eth_getBalance',
                    params: [hexAddress, 'latest'],
                  },
                  {
                    method: 'eth_call',
                    params: [
                      {
                        to: walletContract.address,
                        data: walletContract.encodeFunctionData('assetsOf', [
                          hexAddress as `0x${string}`,
                          scanRes?.result?.list?.filter((asset) => !!asset.contract)?.map((asset) => asset.contract) as Array<`0x${string}`>,
                        ]),
                      },
                      'latest',
                    ],
                  },
                ],
              })
            ).pipe(
              map(([cfxBalance, assetsData]) => {
                const assets = walletContract.decodeFunctionResult('assetsOf', assetsData)?.[0]?.map((asset) => {
                  const info = asset.token as unknown as [string, string, string, number];
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
                  },
                  ...assets.filter(asset => asset.contractAddress !== "0x0000000000000000000000000000000000000000"),
                ];
                return assetsWithCFX;
              })
            );
          } else {
            return [];
          }
        }
        return [];
      })
    );
  };

  const fetchFromChain = () => {
    return from(
      fetchChainBatch<[string, string]>({
        key: `eSpaceAssetsFromChain-${hexAddress}-${network.chainId}`,
        url: network.endpoint,
        rpcs: [
          {
            method: 'eth_getBalance',
            params: [hexAddress, 'latest'],
          },
          {
            method: 'eth_call',
            params: [
              {
                to: walletContract.address,
                data: walletContract.encodeFunctionData('assets', [hexAddress as `0x${string}`, 20n, 0n, 100n]),
              },
              'latest',
            ],
          },
        ],
      })
    ).pipe(
      map(([cfxBalance, assetsData]) => {
        const assets = walletContract.decodeFunctionResult('assets', assetsData)?.[1]?.map((asset) => {
          const info = asset.token as unknown as [string, string, string, number];
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
        return assetsWithCFX;
      })
    );
  };

  return await lastValueFrom(
    fetchFromScan()
      .pipe(catchError(() => fetchFromChain()))
      .pipe(
        catchError((err) => {
          console.log(network.name, err);
          return EMPTY;
        })
      )
  );
};
