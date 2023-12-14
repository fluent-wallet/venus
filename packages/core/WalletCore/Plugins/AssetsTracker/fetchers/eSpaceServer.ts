import { lastValueFrom, from, concatMap, map, catchError, EMPTY } from 'rxjs';
import { createFetchServer, fetchChainBatch } from '@cfx-kit/dapp-utils/dist/fetch';
import { createContract } from '@cfx-kit/dapp-utils/dist/contract';
import { getAddress as toChecksumAddress } from 'ethers';
import ESpaceWalletABI from '../../../../contracts/ABI/ESpaceWallet';
import { ChainType, Network } from './../../../../database/models/Network/index';
import { AssetType, type Asset } from '../../../../database/models/Asset';
import database from '../../../../database';
import methods from '../../../Methods';
import { type AssetWithBalance } from '../';

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
}): Promise<Array<AssetWithBalance>> => {
  const serverFetcher = chainType === ChainType.Mainnet ? eSpaceServerFetcher : eSpaceTestnetServerFetcher;
  const walletContract = chainType === ChainType.Mainnet ? eSpaceWalletContract : eSpaceTestnetWalletContract;
  const tokensHash: Record<
    string,
    { name: string; symbol: string; decimals: number; contractAddress?: string; type: AssetType; icon?: string; priceInUSDT?: string }
  > = Object.create(null);

  const fetchFromScan = () => {
    return from(
      serverFetcher.fetchServer<{ message: string; status: '0' | '1'; result?: { list: Array<AssetInfoFromScan> } }>({
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
              const contractAddress = asset.contract ? toChecksumAddress(asset.contract) : '';
              const hashKey = contractAddress || AssetType.Native;
              let tokenInHash = tokensHash[hashKey];
              if (!tokenInHash) {
                tokenInHash = Object.create(null);
                tokensHash[hashKey] = tokenInHash;
              }
              Object.assign(tokenInHash, {
                priceInUSDT: asset?.priceInUSDT,
                icon: asset?.iconUrl,
                type: asset.type === 'native' ? AssetType.Native : asset.type,
                ...(asset?.contract ? { contractAddress: contractAddress } : null),
              });
            });
            console.log(scanRes?.result?.list)
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
                const assets = walletContract.decodeFunctionResult('assetsOf', assetsData)?.[0];
                const assetsWithCFX = [
                  {
                    token: { name: 'CFX', symbol: 'CFX', decimals: 18, token: '' },
                    balance: BigInt(cfxBalance),
                  },
                  ...assets,
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
                data: walletContract.encodeFunctionData('assets', [hexAddress as `0x${string}`, 20n, 0n, 100n]),
              },
              'latest',
            ],
          },
        ],
      })
    ).pipe(
      map(([cfxBalance, assetsData]) => {
        const assets = walletContract
          .decodeFunctionResult('assets', assetsData)?.[1]
          ?.map((asset) => {
            const info = asset.token as unknown as [string, string, string, number];
            return ({ token: { token: toChecksumAddress(info[0]), name: info[1], symbol: info[2], decimals: Number(info[3]) }, balance: asset.balance });
          });
        const assetsWithCFX = [
          {
            token: { name: 'CFX', symbol: 'CFX', decimals: 18, token: '' },
            balance: BigInt(cfxBalance),
          },
          ...assets,
        ];
        return assetsWithCFX;
      })
    );
  };

  const assetsInfo = await lastValueFrom(
    fetchFromScan()
      .pipe(catchError(() => fetchFromChain()))
      .pipe(
        catchError((err) => {
          console.log(Network.name, err);
          return EMPTY;
        })
      )
  );

  Promise.all(assetsInfo.map((assetInfo) => (!assetInfo.token.token ? network.nativeAsset : network.queryAssetByAddress(assetInfo.token.token)))).then(
    (isAssetsInDB) => {
      const preChanges: Array<Asset> = [];

      isAssetsInDB.forEach((inDB, index) => {
        if (!inDB) {
          const contractAddress = assetsInfo[index].token.token;
          preChanges.push(
            methods.createAsset(
              {
                network,
                type: tokensHash[contractAddress]?.type || AssetType.ERC20,
                contractAddress,
                name: assetsInfo[index].token.name,
                symbol: assetsInfo[index].token.symbol,
                decimals: Number(assetsInfo[index].token.decimals),
                priceInUSDT: tokensHash[contractAddress]?.priceInUSDT ?? null,
                icon: tokensHash[contractAddress]?.icon ?? null,
              },
              true
            )
          );
        }
        if (typeof inDB === 'object') {
          const asset = inDB;
          const hashKey = asset.contractAddress || AssetType.Native;
          if (tokensHash[hashKey]?.priceInUSDT && asset.priceInUSDT !== tokensHash[hashKey]?.priceInUSDT) {
            preChanges.push(methods.prepareUpdateAsset({ asset, priceInUSDT: tokensHash[hashKey]?.priceInUSDT }));
          }
        }
      });

      if (preChanges.length) {
        database.write(async () => {
          await database.batch(...preChanges);
          preChanges.length = 0;
        });
      }
    }
  );

  return assetsInfo.map((asset) => ({
    assetInfo: { contractAddress: asset.token.token, name: asset.token.name, symbol: asset.token.symbol, decimals: Number(asset.token.decimals) },
    balance: String(asset.balance),
  }));
};
