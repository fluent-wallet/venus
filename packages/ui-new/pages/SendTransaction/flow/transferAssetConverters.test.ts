import { AssetType } from '@core/types';
import type { IAsset } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';
import { toTransferAssetFromAssetInfo, toTransferAssetFromIAsset } from './transferAssetConverters';

describe('transferAssetConverters', () => {
  it('keeps flow balances in base units for both legacy asset info and service assets', () => {
    const assetInfo: AssetInfo = {
      type: AssetType.ERC20,
      contractAddress: '0xToken',
      name: 'Token',
      symbol: 'TOK',
      decimals: 6,
      balance: '1230000',
      icon: 'icon',
      priceInUSDT: '1',
    };

    const serviceAsset: IAsset = {
      id: 'asset_1',
      name: 'Token',
      symbol: 'TOK',
      type: AssetType.ERC20,
      contractAddress: '0xToken',
      decimals: 6,
      icon: 'icon',
      source: null,
      balance: '1.23',
      formattedBalance: '1.23',
      priceInUSDT: '1',
      priceValue: '1.23',
      networkId: 'network_1',
      assetRuleId: 'rule_1',
    };

    expect(toTransferAssetFromAssetInfo(assetInfo).balanceBaseUnits).toBe('1230000');
    expect(toTransferAssetFromIAsset(serviceAsset)?.balanceBaseUnits).toBe('1230000');
  });
});
