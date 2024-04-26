/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { of, catchError, from, take, concatMap, defer, map, firstValueFrom, filter, throwIfEmpty } from 'rxjs';
import { truncate } from '../../../utils/balance';
import Decimal from 'decimal.js';
import methods from '../../Methods';
import database from '../../../database';
import { AssetType, AssetSource, type Asset } from './../../../database/models/Asset';
import { type Address } from './../../../database/models/Address';
import { type Network } from './../../../database/models/Network';
import { priorityFetcher, type Fetcher, type FetchAssetBalance, type AssetInfo } from './types';
import { formatUnits } from 'ethers';

const trackAssets = async ({
  chainFetcher,
  networkFetcher,
  nativeAsset,
  network,
  address,
}: {
  chainFetcher?: Fetcher;
  networkFetcher?: Fetcher;
  nativeAsset: Asset;
  network: Network;
  address: Address;
}) => {
  const assetsHash: Record<string, AssetInfo> = {};
  const assetsSortedKeys: Array<string> = [];

  /** Prioritize the use of data from fetchFromServer. */
  if (chainFetcher && typeof chainFetcher.fetchFromServer === 'function') {
    let assets: AssetInfo[];
    try {
      assets = await chainFetcher.fetchFromServer({ address, network });
      assets?.forEach((asset) => {
        if (!asset.contractAddress) {
          assetsHash[AssetType.Native] = asset;
          assetsHash[AssetType.Native].icon = nativeAsset.icon ?? undefined;
        } else {
          assetsHash[asset.contractAddress] = asset;
        }
      });
    } catch (err) {
      assets = [];
    }

    /**
     * It is important to note that the data fromServer should itself contain information about the token, which may not be recorded locally.
     * The token information from the AssetRule itself is already recorded locally.
     * So if there is an asset fromServer that has not been written to the DB, should write it here.
     */
    Promise.all(assets.map((asset) => (!asset.contractAddress ? nativeAsset : network.queryAssetByAddress(asset.contractAddress)))).then((isAssetsInDB) => {
      const preChanges: Array<Asset> = [];

      isAssetsInDB.forEach((inDB, index) => {
        const contractAddress = assets[index].contractAddress;
        if (inDB === undefined && contractAddress) {
          preChanges.push(
            methods.createAsset(
              {
                network,
                ...assets[index],
                source: AssetSource.Official,
              },
              true,
            ),
          );
        }

        if (typeof inDB === 'object') {
          const assetInDB = inDB;
          const priceChanged = assets[index].priceInUSDT && assetInDB.priceInUSDT !== assets[index].priceInUSDT;
          const iconChanged = assets[index].icon && assetInDB.icon !== assets[index].icon;
          if (priceChanged || iconChanged) {
            preChanges.push(
              methods.prepareUpdateAsset({
                asset: assetInDB,
                ...(priceChanged ? { priceInUSDT: assets[index].priceInUSDT } : null),
                ...(iconChanged ? { icon: assets[index].icon } : null),
              }),
            );
          }
        }
      });

      if (preChanges.length) {
        database.write(async () => {
          await database.batch(...preChanges);
          preChanges.length = 0;
        });
      }
    });
  }

  /**
   * If there are tokens in the AssetRule that need to be prioritized for display that are not included in the fromServer's data
   * Then should use the chain's own method to get the balacne level by level.
   * */
  const currentAssetRule = await address.assetRule;
  const assetsInRule = await currentAssetRule.assets;
  const assetsNeedFetch = assetsInRule
    .filter((asset) => !assetsHash[asset.contractAddress || AssetType.Native])
    .filter((asset) => asset.type !== AssetType.ERC721 && asset.type !== AssetType.ERC1155);

  if (assetsNeedFetch.length) {
    const fetchers: Array<FetchAssetBalance> = [];
    for (const name of priorityFetcher) {
      if (chainFetcher && chainFetcher?.[name] && !fetchers.some((m) => m.name === name)) {
        fetchers.push(chainFetcher[name]!);
      }

      if (networkFetcher && networkFetcher?.[name] && !fetchers.some((m) => m.name === name)) {
        fetchers.push(networkFetcher[name]!);
      }
    }

    if (fetchers.length > 0) {
      const balancesResult = await firstValueFrom(
        from(fetchers).pipe(
          concatMap((fetchAssetBalances) =>
            defer(() =>
              fetchAssetBalances({
                key: `assetsBalanceInRules-${address.hex}-${network.chainId}`,
                endpoint: network.endpoint,
                accountAddress: address,
                assets: assetsNeedFetch.map((asset) => ({ assetType: asset.type, contractAddress: asset.contractAddress })),
              }),
            ).pipe(
              map((results) => {
                if (Array.isArray(results) && results.every((item) => typeof item === 'string')) {
                  return results;
                } else {
                  throw new Error('Invalid data type in results');
                }
              }),
              catchError(() => of(null)),
            ),
          ),
          filter((result) => result !== null),
          take(1),
          throwIfEmpty(() => new Error('All fetchers failed')),
        ),
      );

      const assets: Array<AssetInfo> | undefined = balancesResult?.map((balance, index) => {
        const asset = assetsNeedFetch[index];

        return {
          type: asset.type!,
          contractAddress: asset.contractAddress!,
          name: asset.name!,
          symbol: asset.symbol!,
          decimals: asset.decimals!,
          balance: typeof balance === 'string' ? balance : undefined!,
          icon: asset.icon!,
        };
      });
      assets?.forEach((asset) => (assetsHash[asset.contractAddress || AssetType.Native] = asset));
    }
  }

  for (const hashKey in assetsHash) {
    if (!!assetsHash[hashKey].priceInUSDT && !!assetsHash[hashKey].balance) {
      assetsHash[hashKey].balance = BigInt(assetsHash[hashKey].balance || 0).toString();
      assetsHash[hashKey].priceValue = truncate(
        new Decimal(assetsHash[hashKey].priceInUSDT!)
          .mul(new Decimal(assetsHash[hashKey].balance).div(Decimal.pow(new Decimal(10), new Decimal(assetsHash[hashKey].decimals ?? 0))))
          .toString(),
        2,
      );
    }
  }

  const inRuleMap: Record<string, boolean> = {};
  assetsSortedKeys.length = 0;
  assetsInRule.forEach((asset) => {
    assetsSortedKeys.push(asset.hashKey);
    inRuleMap[asset.hashKey] = true;
  });
  Object.keys(assetsHash)
    .filter((hashKey) => !inRuleMap[hashKey])
    .sort((a, b) => {
      const assetA = assetsHash[a];
      const assetB = assetsHash[b];
      if (assetA.type === AssetType.Native) return -1;
      if (assetB.type === AssetType.Native) return 1;

      if (typeof assetA.priceValue === 'string' && typeof assetB.priceValue === 'string') {
        return Number(formatUnits(assetA.balance, assetA.decimals)) * Number(assetA.priceInUSDT) <
          Number(formatUnits(assetB.balance, assetB.decimals)) * Number(assetB.priceInUSDT)
          ? 1
          : -1;
      } else if (assetA.priceInUSDT) {
        return -1;
      } else if (assetB.priceInUSDT) {
        return 1;
      }
      const varA = assetA.symbol[0].toLocaleUpperCase();
      const varB = assetB.symbol[0].toLocaleUpperCase();
      if (varA === varB) {
        return 0;
      }
      return varA < varB ? -1 : 1;
    })
    .forEach((hashKey) => assetsSortedKeys.push(hashKey));

  return { assetsHash, assetsSortedKeys } as const;
};

export default trackAssets;
