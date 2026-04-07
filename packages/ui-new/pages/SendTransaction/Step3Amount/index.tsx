import { BottomSheetFooter, BottomSheetScrollContent } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { AccountItemView } from '@modules/AccountsList';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import { useTheme } from '@react-navigation/native';
import { type SendTransactionScreenProps, type SendTransactionStep3StackName, SendTransactionStep4StackName } from '@router/configs';
import type { INftItem } from '@service/core';
import Decimal from 'decimal.js';
import type React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, View } from 'react-native';
import { type TransferAsset, toLegacyAssetInfo, toLegacyNftItem, useSendFlow } from '../flow';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import SetAssetAmount, { type AmountAsset, type AmountInfo, type SetAssetAmountMethods } from './SetAssetAmount';

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
  const setAssetAmountMethodsRef = useRef<SetAssetAmountMethods>(null);
  const [amountInfo, setAmountInfo] = useState<null | AmountInfo>(null);
  const asset = draft.asset as TransferAsset;
  const nftItemDetail = toLegacyNftItem(asset);

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
          ref={setAssetAmountMethodsRef}
          targetAddress={draft.recipient}
          asset={toAmountAsset(asset)}
          nftItemDetail={nftItemDetail}
          defaultAmount={draft.amountInput}
          onAmountInfoChange={(info) => {
            setAmountInfo(info);
            setDraft((prev) => ({
              ...prev,
              amountInput: info.amount,
              amountMode: info.inMaxMode ? 'max' : 'exact',
            }));
          }}
        />
      </BottomSheetScrollContent>

      <BottomSheetFooter innerPaddingHorizontal>
        <Button
          testID="next"
          disabled={!amountInfo || (amountInfo.validMax !== null && amountInfo.isAmountValid !== true)}
          onPress={
            !amountInfo || amountInfo.validMax === null
              ? () => setAssetAmountMethodsRef.current?.handleEstimateMax?.()
              : () => {
                  if (Keyboard.isVisible()) {
                    Keyboard.dismiss();
                  }
                  setDraft((prev) => ({
                    ...prev,
                    amountInput: amountInfo.inMaxMode ? new Decimal(asset.balanceBaseUnits).div(Decimal.pow(10, asset.decimals)).toString() : amountInfo.amount,
                    amountMode: amountInfo.inMaxMode ? 'max' : 'exact',
                  }));
                  navigation.navigate(SendTransactionStep4StackName);
                }
          }
          size="small"
          loading={amountInfo?.inEstimate}
        >
          {!amountInfo || amountInfo.validMax === null ? t('tx.amount.estimateMax') : t('common.next')}
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
