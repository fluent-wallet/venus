import 'reflect-metadata';
import { AssetType } from '@core/types';
import { StackActions } from '@react-navigation/native';
import { SendTransactionStackName, type StackNavigation } from '@router/configs';
import type { IAsset } from '@service/core';
import type { PaymentUriPayload } from '@utils/payment-uri';
import type { TFunction } from 'i18next';
import { routeParsedPaymentUri } from './paymentUriRouting';

jest.mock('@react-navigation/native', () => ({
  StackActions: {
    replace: jest.fn((name: string, params: unknown) => ({
      type: 'REPLACE',
      payload: { name, params },
    })),
  },
}));

jest.mock('@service/address', () => ({
  isValidAddress: jest.fn(() => true),
}));

describe('paymentUriRouting', () => {
  const t = ((key: string) => key) as unknown as TFunction;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a send entry with base-unit balance for token payment uris', () => {
    const navigation = {
      dispatch: jest.fn(),
    } as unknown as StackNavigation;

    const tokenAsset: IAsset = {
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

    const paymentUri: PaymentUriPayload = {
      protocol: 'ethereum',
      address: '0xReceiver',
      method: 'transfer',
      params: {
        address: '0xToken',
        uint256: '500000',
      },
    };

    const result = routeParsedPaymentUri({
      paymentUri,
      assets: [tokenAsset],
      navigation,
      t,
    });

    expect(result).toEqual({ ok: true, data: paymentUri });
    expect(StackActions.replace).toHaveBeenCalledWith(SendTransactionStackName, {
      entry: {
        kind: 'review',
        recipient: '0xReceiver',
        asset: {
          type: AssetType.ERC20,
          contractAddress: '0xToken',
          name: 'Token',
          symbol: 'TOK',
          decimals: 6,
          balanceBaseUnits: '1230000',
          icon: 'icon',
          priceInUSDT: '1',
          nft: null,
        },
        amountInput: '0.5',
        amountMode: 'exact',
      },
    });
    expect(navigation.dispatch).toHaveBeenCalledWith({
      type: 'REPLACE',
      payload: {
        name: SendTransactionStackName,
        params: {
          entry: {
            kind: 'review',
            recipient: '0xReceiver',
            asset: {
              type: AssetType.ERC20,
              contractAddress: '0xToken',
              name: 'Token',
              symbol: 'TOK',
              decimals: 6,
              balanceBaseUnits: '1230000',
              icon: 'icon',
              priceInUSDT: '1',
              nft: null,
            },
            amountInput: '0.5',
            amountMode: 'exact',
          },
        },
      },
    });
  });
});
