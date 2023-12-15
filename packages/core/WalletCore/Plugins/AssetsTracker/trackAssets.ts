/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { of, catchError, from, take, concat, firstValueFrom } from 'rxjs';
import { truncate } from '../../../utils/balance';
import Decimal from 'decimal.js';
import methods from '../../Methods';
import database from '../../../database';
import { AssetType, type Asset } from './../../../database/models/Asset';
import { type Address } from './../../../database/models/Address';
import { type Network } from './../../../database/models/Network';
import { priorityFetcher, type Fetcher, type FetchAssetBalance, type AssetInfo } from './types';

const trackAssets = async ({
  chainFetcher,
  networkFetcher,
  nativeAsset,
  network,
  address,
  assetsHash,
  assetsSortedKeys,
}: {
  chainFetcher?: Fetcher;
  networkFetcher?: Fetcher;
  nativeAsset: Asset;
  network: Network;
  address: Address;
  assetsHash: { [hashKey: string]: AssetInfo };
  assetsSortedKeys: Array<string>;
}) => {
  /** Prioritize the use of data from fetchFromServer. */
  if (chainFetcher && typeof chainFetcher.fetchFromServer === 'function') {
    // const assets: AssetInfo[] = [];
    const assets = await chainFetcher.fetchFromServer({ address, network });
    assets?.forEach((asset) => (assetsHash[asset.contractAddress || AssetType.Native] = asset));

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
              },
              true
            )
          );
        }

        if (typeof inDB === 'object') {
          const assetInDB = inDB;
          if (assets[index].priceInUSDT && assetInDB.priceInUSDT !== assets[index].priceInUSDT) {
            preChanges.push(methods.prepareUpdateAsset({ asset: assetInDB, priceInUSDT: assets[index].priceInUSDT }));
          }
          if (assets[index].icon && assetInDB.icon !== assets[index].icon) {
            preChanges.push(methods.prepareUpdateAsset({ asset: assetInDB, icon: assets[index].icon }));
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
        concat(
          ...fetchers.map((fetchAssetBalances) =>
            from(
              fetchAssetBalances({
                endpoint: network.endpoint,
                account: address.hex,
                assets: assetsNeedFetch.map((asset) => ({ assetType: asset.type, contractAddress: asset.contractAddress })),
              })
            ).pipe(catchError(() => of(null)))
          )
        ).pipe(take(1))
      );
      const assets: Array<AssetInfo> | undefined = balancesResult?.map((balance, index) => {
        const asset = assetsNeedFetch[index];
        return {
          type: asset.type!,
          contractAddress: asset.contractAddress!,
          name: asset.name!,
          symbol: asset.symbol!,
          decimals: asset.decimals!,
          balance,
        };
      });
      assets?.forEach((asset) => (assetsHash[asset.contractAddress || AssetType.Native] = asset));
    }
  }

  for (const hashKey in assetsHash) {
    if (!!assetsHash[hashKey].priceInUSDT && !!assetsHash[hashKey].balance) {
      assetsHash[hashKey].priceValue = truncate(
        new Decimal(assetsHash[hashKey].priceInUSDT!)
          .mul(new Decimal(assetsHash[hashKey].balance).div(Decimal.pow(new Decimal(10), new Decimal(assetsHash[hashKey].decimals ?? 0))))
          .toString(),
        2
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
      return (typeof assetB.priceValue === 'string' ? Number(assetB.priceValue) : 0) - (typeof assetA.priceValue === 'string' ? Number(assetA.priceValue) : 0);
    })
    .forEach((hashKey) => assetsSortedKeys.push(hashKey));
};

export default trackAssets;
