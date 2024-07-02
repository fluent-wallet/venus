import ArrowRigiht from '@assets/icons/arrow-right2.svg';
import BottomSheet, {
  snapPoints,
  BottomSheetWrapper,
  BottomSheetScrollContent,
  BottomSheetHeader,
  BottomSheetFooter,
  type BottomSheetMethods,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useCurrentAddressValue, useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import SelectAsset from '@pages/SendTransaction/Step2Asset';
import SetAssetAmount, { type AmountInfo, type SetAssetAmountMethods } from '@pages/SendTransaction/Step3Amount/SetAssetAmount';
import { useTheme } from '@react-navigation/native';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet } from 'react-native';

interface Props {
  selectedAsset: AssetInfo | null;
  amount: string;
  onConfirm: (params: { asset: AssetInfo; amount?: string }) => void;
  onClose: () => void;
}

const ReceiveSetAsset: React.FC<Props> = ({ onConfirm, selectedAsset, amount, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetworkNativeAsset = useCurrentNetworkNativeAsset();
  const [tempSelectAsset, setTempSelectAsset] = useState<AssetInfo | null>(() => selectedAsset || (currentNetworkNativeAsset as unknown as AssetInfo));
  const [showSelectAsset, setShowSelectAsset] = useState(false);
  const currentAddressValue = useCurrentAddressValue()!;

  const setAssetAmountMethodsRef = useRef<SetAssetAmountMethods>(null);
  const [amountInfo, setAmountInfo] = useState<null | AmountInfo>(null);

  useEffect(() => {
    if (!tempSelectAsset && currentNetworkNativeAsset) {
      setTempSelectAsset(currentNetworkNativeAsset as unknown as AssetInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNetworkNativeAsset?.id]);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.large} index={0} onClose={onClose}>
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetHeader title={t('receive.title')} />
          <BottomSheetScrollContent>
            <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>{t('receive.selectAnAsset')}</Text>
            <Pressable
              style={({ pressed }) => [styles.assetWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              onPress={() => setShowSelectAsset(true)}
              testID="selectAsset"
            >
              {tempSelectAsset && (
                <>
                  <TokenIcon style={styles.assetIcon} source={tempSelectAsset?.icon} />
                  <Text style={[styles.assetName, { color: colors.textPrimary }]}>{tempSelectAsset.name}</Text>
                  {tempSelectAsset.name !== tempSelectAsset.symbol && (
                    <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{tempSelectAsset.symbol}</Text>
                  )}
                  <ArrowRigiht color={colors.iconPrimary} style={styles.assetArrow} />
                </>
              )}
              {!tempSelectAsset && <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{t('receive.clickHereToSelect')}</Text>}
            </Pressable>

            {tempSelectAsset && (
              <>
                <Text style={[styles.text, styles.amount, { color: colors.textSecondary }]}>{t('common.amount')}</Text>
                <SetAssetAmount
                  ref={setAssetAmountMethodsRef}
                  targetAddress={currentAddressValue}
                  asset={tempSelectAsset}
                  isReceive
                  defaultAmount={amount}
                  onAmountInfoChange={setAmountInfo}
                />
              </>
            )}
          </BottomSheetScrollContent>
          <BottomSheetFooter>
            {tempSelectAsset && (
              <Button
                testID="continue"
                disabled={!amountInfo || (!!amountInfo.amount && amountInfo.isAmountValid !== true)}
                size="small"
                onPress={() => {
                  if (Keyboard.isVisible()) {
                    Keyboard.dismiss();
                    setTimeout(() => bottomSheetRef.current?.close(), 188);
                  } else {
                    bottomSheetRef.current?.close();
                  }
                  onConfirm({ asset: tempSelectAsset, amount: amountInfo?.amount });
                }}
              >
                {t('common.continue')}
              </Button>
            )}
            {!tempSelectAsset && (
              <Button size="small" onPress={() => setShowSelectAsset(true)}>
                {t('receive.selectAsset')}
              </Button>
            )}
          </BottomSheetFooter>
        </BottomSheetWrapper>
      </BottomSheet>
      {showSelectAsset && <SelectAsset selectType="Receive" onConfirm={(asset) => setTempSelectAsset(asset)} onClose={() => setShowSelectAsset(false)} />}
    </>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  to: {
    marginTop: 24,
    marginBottom: 8,
  },
  assetWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: 56,
    paddingLeft: 64,
  },
  assetIcon: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 40,
  },
  assetSymbol: { fontSize: 12, fontWeight: '300', lineHeight: 16, marginTop: 6 },
  assetName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  assetArrow: {
    position: 'absolute',
    right: 16,
  },
  amount: {
    marginTop: 24,
    marginBottom: 8,
  },
});

export default ReceiveSetAsset;
