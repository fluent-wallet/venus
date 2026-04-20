import { ASSET_TYPE, NetworkType } from '@core/types';
import { buildTransferIntent, canUseMaxAmount, getTransferAmountInputValue } from './transferIntent';
import type { TransferAsset } from './types';

describe('transferIntent helpers', () => {
  it('builds a conflux fungible intent with crc20 standard', () => {
    const asset: TransferAsset = {
      type: ASSET_TYPE.ERC20,
      contractAddress: 'cfx:achc8nxj7r451c223m18w2dwjnmhkd6rxawrvkvsy2',
      name: 'FC',
      symbol: 'FC',
      decimals: 18,
      balanceBaseUnits: '1000000000000000000',
      nft: null,
    };

    expect(
      buildTransferIntent({
        recipient: 'cfx:aammk09dzwga14hf4gp99bkv6k2y8hvuzpaa4f75g4',
        asset,
        amountIntent: {
          kind: 'exact',
          amount: '1',
        },
        networkType: NetworkType.Conflux,
      }),
    ).toEqual({
      recipient: 'cfx:aammk09dzwga14hf4gp99bkv6k2y8hvuzpaa4f75g4',
      asset: {
        kind: 'fungible',
        standard: 'crc20',
        contractAddress: 'cfx:achc8nxj7r451c223m18w2dwjnmhkd6rxawrvkvsy2',
        symbol: 'FC',
        decimals: 18,
      },
      amount: {
        kind: 'exact',
        amount: '1',
      },
    });
  });

  it('exposes max support and resolved max display helpers', () => {
    const asset: TransferAsset = {
      type: ASSET_TYPE.Native,
      contractAddress: '',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      balanceBaseUnits: '1000000000000000000',
      nft: null,
    };

    expect(canUseMaxAmount(asset)).toBe(true);
    expect(
      getTransferAmountInputValue({
        amountIntent: {
          kind: 'max',
        },
        resolvedMaxAmount: '0.98',
      }),
    ).toBe('0.98');
  });
});
