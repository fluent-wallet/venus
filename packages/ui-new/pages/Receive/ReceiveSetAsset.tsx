import ArrowRigiht from '@assets/icons/arrow-right2.svg';
import {
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetScrollContent,
  BottomSheetWrapper,
  InlineBottomSheet,
  snapPoints,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import SelectAsset from '@pages/SendTransaction/Step2Asset';
import SetAssetAmount, { type AmountAsset, type AmountInfo } from '@pages/SendTransaction/Step3Amount/SetAssetAmount';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { useCurrentNetwork } from '@service/network';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet } from 'react-native';
import type { ReceiveAsset } from './types';
import { toReceiveAssetFromIAsset } from './types';

interface Props {
  selectedAsset: ReceiveAsset | null;
  amount: string;
  onConfirm: (params: { asset: ReceiveAsset; amount?: string }) => void;
  onClose: () => void;
  isOpen?: boolean;
}

function toAmountAssetInput(asset: ReceiveAsset): AmountAsset {
  return {
    type: asset.type,
    contractAddress: asset.contractAddress,
    name: asset.name,
    symbol: asset.symbol,
    decimals: asset.decimals,
    balance: asset.balanceBaseUnits,
    icon: asset.icon,
    priceInUSDT: asset.priceInUSDT,
    priceValue: asset.priceValue,
  };
}

function toReceiveAssetFromLegacyAssetInfo(params: { asset: AssetInfo; networkId: string; addressId: string }): ReceiveAsset {
  return {
    type: String(params.asset.type),
    contractAddress: params.asset.contractAddress ?? '',
    name: params.asset.name ?? '',
    symbol: params.asset.symbol ?? '',
    decimals: typeof params.asset.decimals === 'number' ? params.asset.decimals : 18,
    icon: params.asset.icon,
    priceInUSDT: params.asset.priceInUSDT,
    priceValue: params.asset.priceValue,
    balanceBaseUnits: params.asset.balance ?? '0',
    networkId: params.networkId,
    addressId: params.addressId,
  };
}

const ReceiveSetAsset: React.FC<Props> = ({ onConfirm, selectedAsset, amount, onClose, isOpen }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);

  const { data: currentAddress } = useCurrentAddress();
  const currentAddressValue = currentAddress?.value ?? '';
  const currentAddressId = currentAddress?.id ?? '';
  const { data: currentNetwork } = useCurrentNetwork();
  const currentNetworkId = currentNetwork?.id ?? '';

  const assetsQuery = useAssetsOfCurrentAddress();
  const [tempSelectAsset, setTempSelectAsset] = useState<ReceiveAsset | null>(() => selectedAsset);

  const [showSelectAsset, setShowSelectAsset] = useState(false);

  const [amountInfo, setAmountInfo] = useState<null | AmountInfo>(null);

  useEffect(() => {
    if (tempSelectAsset) {
      return;
    }

    const nativeAsset = (assetsQuery.data ?? []).find((asset) => String(asset.type) === 'Native');
    if (nativeAsset && currentAddressId) {
      setTempSelectAsset(toReceiveAssetFromIAsset({ asset: nativeAsset, networkId: nativeAsset.networkId, addressId: currentAddressId }));
    }
  }, [assetsQuery.data, currentAddressId, tempSelectAsset]);

  return (
    <>
      <InlineBottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints.large}
        index={isOpen ? 0 : -1}
        onClose={() => {
          setShowSelectAsset(false);
          onClose();
        }}
      >
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
                  <TokenIcon style={styles.assetIcon} source={tempSelectAsset.icon} />
                  <Text style={[styles.assetName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {tempSelectAsset.name}
                  </Text>
                  {tempSelectAsset.name !== tempSelectAsset.symbol && (
                    <Text style={[styles.assetSymbol, { color: colors.textSecondary }]} numberOfLines={1}>
                      {tempSelectAsset.symbol}
                    </Text>
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
                  targetAddress={currentAddressValue}
                  asset={toAmountAssetInput(tempSelectAsset)}
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
      </InlineBottomSheet>

      {showSelectAsset && (
        <SelectAsset
          selectType="Receive"
          onConfirm={(asset) => {
            const networkId = currentNetworkId || assetsQuery.data?.[0]?.networkId || '';
            if (!networkId || !currentAddressId) {
              return;
            }
            setTempSelectAsset(toReceiveAssetFromLegacyAssetInfo({ asset, networkId, addressId: currentAddressId }));
          }}
          onClose={() => {
            setShowSelectAsset(false);
          }}
        />
      )}
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
