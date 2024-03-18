import React, { useState, useRef, type MutableRefObject } from 'react';
import { useTheme } from '@react-navigation/native';
import { View, StyleSheet, Pressable } from 'react-native';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useAssetsTokenList, useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import SelectAsset from '@pages/SendTranscation/Step2Asset';
import SetAssetAmount from '@pages/SendTranscation/Step3Amount/SetAssetAmount';

interface Props {
  onConfirm: (params: { asset: AssetInfo; amount?: string }) => void;
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
}

const ReceiveSetAsset: React.FC<Props> = ({ bottomSheetRef, onConfirm }) => {
  const { colors } = useTheme();
  const selectAssetRef = useRef<BottomSheetMethods>(null!);

  const currentAddressValue = useCurrentAddressValue()!;
  const assetsToken = useAssetsTokenList();
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(() => assetsToken?.[0] || null);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.large} isModal={true}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Receive</Text>

          <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>Select a token</Text>
          <Pressable
            style={({ pressed }) => [styles.assetWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => selectAssetRef.current?.present()}
          >
            {selectedAsset && (
              <>
                <TokenIcon style={styles.assetIcon} source={selectedAsset?.icon} />
                <Text style={[styles.assetSymbol, { color: colors.textPrimary }]}>{selectedAsset.symbol}</Text>
                {selectedAsset.name !== selectedAsset.symbol && <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{selectedAsset.name}</Text>}
              </>
            )}
            {!selectedAsset && <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>Click Here to select</Text>}
          </Pressable>

          {selectedAsset && (
            <>
              <Text style={[styles.text, styles.amount, { color: colors.textSecondary }]}>Amount</Text>
              <SetAssetAmount targetAddress={currentAddressValue} asset={selectedAsset} isReceive>
                {({ amount, isAmountValid }) => (
                  <Button
                    style={styles.btn}
                    mode="auto"
                    disabled={!!amount && isAmountValid !== true}
                    size="small"
                    onPress={() => {
                      onConfirm({ asset: selectedAsset, amount });
                      bottomSheetRef.current?.dismiss();
                    }}
                  >
                    Continue
                  </Button>
                )}
              </SetAssetAmount>
            </>
          )}
          {!selectedAsset && (
            <Button style={styles.btn} mode="auto" size="small" onPress={() => selectAssetRef.current?.present()}>
              Select Asset
            </Button>
          )}
        </View>
      </BottomSheet>
      <SelectAsset bottomSheetRefOuter={selectAssetRef} onConfirm={(asset) => setSelectedAsset(asset)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  to: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  assetWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: 56,
    paddingLeft: 64,
    paddingRight: 16,
  },
  assetIcon: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 40,
  },
  assetSymbol: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  assetName: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
    marginTop: 6,
  },
  amount: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default ReceiveSetAsset;
