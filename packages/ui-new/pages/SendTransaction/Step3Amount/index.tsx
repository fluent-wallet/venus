import { BottomSheetFooter, BottomSheetScrollContent } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { ASSET_TYPE } from '@core/types';
import { AccountItemView } from '@modules/AccountsList';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import { useTheme } from '@react-navigation/native';
import { type SendTransactionScreenProps, type SendTransactionStep3StackName, SendTransactionStep4StackName } from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import type { INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useTransferPrecheck } from '@service/transaction';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import {
  buildTransferIntent,
  canUseMaxAmount,
  getTransferAmountInputValue,
  type TransferAsset,
  toLegacyAssetInfo,
  toLegacyNftItem,
  useSendFlow,
} from '../flow';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import { getTransferPrecheckQueryErrorTranslationKey } from './amountInputHelpers';
import SetAssetAmount, { type AmountAsset } from './SetAssetAmount';

function toAmountAsset(asset: TransferAsset): AmountAsset {
  return {
    type: asset.type,
    contractAddress: asset.contractAddress,
    name: asset.name,
    symbol: asset.symbol,
    decimals: asset.decimals,
    balanceBaseUnits: asset.balanceBaseUnits,
    icon: asset.icon,
    priceInUSDT: asset.priceInUSDT,
  };
}

const SendTransactionStep3Amount: React.FC<SendTransactionScreenProps<typeof SendTransactionStep3StackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { draft, setDraft } = useSendFlow();
  const { data: currentAddress } = useCurrentAddress();
  const { data: currentNetwork } = useCurrentNetwork();
  const { data: assets } = useAssetsOfCurrentAddress();
  const asset = draft.asset as TransferAsset;
  const nftItemDetail = toLegacyNftItem(asset);
  const nativeAsset = useMemo(() => assets?.find((item) => item.type === ASSET_TYPE.Native) ?? null, [assets]);
  const transferIntent = useMemo(() => {
    if (!currentNetwork) {
      return null;
    }

    return buildTransferIntent({
      recipient: draft.recipient,
      asset,
      amountIntent: draft.amountIntent,
      networkType: currentNetwork.networkType,
    });
  }, [asset, currentNetwork, draft.amountIntent, draft.recipient]);
  const maxTransferIntent = useMemo(() => {
    if (!currentNetwork || !canUseMaxAmount(asset)) {
      return null;
    }

    return buildTransferIntent({
      recipient: draft.recipient,
      asset,
      amountIntent: { kind: 'max' },
      networkType: currentNetwork.networkType,
    });
  }, [asset, currentNetwork, draft.recipient]);
  const canRunPrecheck =
    Boolean(currentAddress?.id && transferIntent && draft.recipient.trim()) &&
    (draft.amountIntent.kind === 'max' || draft.amountIntent.amount.trim().length > 0);
  const currentPrecheckInput = canRunPrecheck && currentAddress?.id && transferIntent ? { addressId: currentAddress.id, intent: transferIntent } : null;
  const currentPrecheck = useTransferPrecheck(currentPrecheckInput);
  const maxPrecheck = useTransferPrecheck(
    currentAddress?.id && maxTransferIntent && draft.recipient.trim()
      ? {
          addressId: currentAddress.id,
          intent: maxTransferIntent,
        }
      : null,
  );
  const defaultAmount = useMemo(
    () =>
      getTransferAmountInputValue({
        amountIntent: draft.amountIntent,
        resolvedMaxAmount: maxPrecheck.data?.maxAmount ?? null,
      }),
    [draft.amountIntent, maxPrecheck.data?.maxAmount],
  );
  const precheckErrorMessage = useMemo(() => {
    if (currentPrecheck.error) {
      return t(getTransferPrecheckQueryErrorTranslationKey(currentPrecheck.error));
    }

    const precheckError = currentPrecheck.data?.error;
    if (!precheckError) {
      return null;
    }

    if (precheckError.code === 'insufficient_asset_balance') {
      return t('tx.amount.error.InsufficientBalance', { symbol: asset.symbol });
    }

    if (precheckError.code === 'insufficient_native_for_fee') {
      return asset.type === ASSET_TYPE.Native
        ? t('tx.confirm.error.InsufficientBalance', { symbol: nativeAsset?.symbol ?? asset.symbol })
        : t('tx.confirm.error.InsufficientBalanceForGas', { symbol: nativeAsset?.symbol ?? 'CFX' });
    }

    if (precheckError.code === 'invalid_amount') {
      return t('tx.amount.error.invalidAmount');
    }

    return precheckError.message;
  }, [asset.symbol, asset.type, currentPrecheck.data?.error, currentPrecheck.error, nativeAsset?.symbol, t]);
  const handleRequestMax = useCallback(async () => {
    if (!currentAddress?.id || !maxTransferIntent) {
      return null;
    }

    const cachedMaxAmount = maxPrecheck.data?.maxAmount ?? null;
    if (cachedMaxAmount !== null) {
      setDraft((prev) =>
        prev.amountIntent.kind === 'max'
          ? prev
          : {
              ...prev,
              amountIntent: {
                kind: 'max',
              },
            },
      );
      return cachedMaxAmount;
    }

    const maxPrecheckResult = await maxPrecheck.refetch();
    const maxAmount = maxPrecheckResult.data?.maxAmount ?? null;
    if (maxAmount == null) {
      showMessage({
        type: 'warning',
        message: t(maxPrecheckResult.error ? getTransferPrecheckQueryErrorTranslationKey(maxPrecheckResult.error) : 'tx.amount.error.estimate'),
      });
      return null;
    }

    setDraft((prev) =>
      prev.amountIntent.kind === 'max'
        ? prev
        : {
            ...prev,
            amountIntent: {
              kind: 'max',
            },
          },
    );
    return maxAmount;
  }, [currentAddress?.id, maxPrecheck, maxTransferIntent, setDraft, t]);
  const handleAmountInfoChange = useCallback(
    (info: { inMaxMode: boolean; amount: string }) => {
      setDraft((prev) => {
        const nextAmountIntent = info.inMaxMode
          ? {
              kind: 'max' as const,
            }
          : {
              kind: 'exact' as const,
              amount: info.amount,
            };

        if (prev.amountIntent.kind === nextAmountIntent.kind && (prev.amountIntent.kind === 'max' || prev.amountIntent.amount === info.amount)) {
          return prev;
        }

        return {
          ...prev,
          amountIntent: nextAmountIntent,
        };
      });
    },
    [setDraft],
  );
  const isAmountValid = useMemo(() => {
    if (!canRunPrecheck) {
      return null;
    }

    if (currentPrecheck.error) {
      return false;
    }

    return currentPrecheck.data?.canContinue ?? null;
  }, [canRunPrecheck, currentPrecheck.data?.canContinue, currentPrecheck.error]);
  const canContinue = isAmountValid === true;
  const isCurrentPrecheckLoading = canRunPrecheck && currentPrecheck.isFetching;

  return (
    <SendTransactionBottomSheet title={t('tx.send.title')} isRoute snapPoints={['75%']} useBottomSheetView={false}>
      <BottomSheetScrollContent innerPaddingHorizontal>
        {nftItemDetail && (
          <>
            <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>{t('common.send')}</Text>
            <NFT colors={colors} asset={toLegacyAssetInfo(asset)} nftItemDetail={nftItemDetail} />
          </>
        )}

        <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>{t('common.to')}</Text>
        <AccountItemView nickname={''} addressValue={draft.recipient} colors={colors} innerPaddingHorizontal={false} />

        <SetAssetAmount
          asset={toAmountAsset(asset)}
          nftItemDetail={nftItemDetail}
          defaultAmount={defaultAmount}
          defaultInMaxMode={draft.amountIntent.kind === 'max'}
          resolvedMaxAmount={maxPrecheck.data?.maxAmount ?? null}
          isAmountValidOverride={isAmountValid}
          errorMessageOverride={canRunPrecheck ? precheckErrorMessage : null}
          onRequestMax={canUseMaxAmount(asset) ? handleRequestMax : undefined}
          maxLoading={maxPrecheck.isFetching}
          onAmountInfoChange={handleAmountInfoChange}
        />
      </BottomSheetScrollContent>

      <BottomSheetFooter innerPaddingHorizontal>
        <Button
          testID="next"
          disabled={!canContinue}
          onPress={() => {
            if (Keyboard.isVisible()) {
              Keyboard.dismiss();
            }
            navigation.navigate(SendTransactionStep4StackName);
          }}
          size="small"
          loading={isCurrentPrecheckLoading}
        >
          {t('common.next')}
        </Button>
      </BottomSheetFooter>
    </SendTransactionBottomSheet>
  );
};

export const NFT: React.FC<{
  colors: ReturnType<typeof useTheme>['colors'];
  asset: { name?: string };
  nftItemDetail: INftItem;
}> = ({ colors, asset, nftItemDetail }) => (
  <View style={styles.nftItem}>
    <NFTIcon style={styles.nftItemImg} source={nftItemDetail.icon} isNftItem placeholderContentFit="cover" contentFit="cover" />
    <Text style={[styles.nftAssetName, { color: colors.textSecondary }]}>{asset.name}</Text>
    <Text style={[styles.nftItemName, { color: colors.textPrimary }]}>{getDetailSymbol(nftItemDetail)}</Text>
  </View>
);

const styles = StyleSheet.create({
  nftItem: {
    marginTop: 14,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: 60,
    paddingLeft: 92,
  },
  nftItemImg: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 60,
    height: 60,
    borderRadius: 2,
  },
  nftAssetName: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },
  nftItemName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  to: {
    marginTop: 16,
    marginBottom: 4,
  },
  amount: {
    marginTop: 22,
    marginBottom: 16,
  },
});

export default SendTransactionStep3Amount;
