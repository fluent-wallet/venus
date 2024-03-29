import React, { useState, useRef } from 'react';
import { StyleSheet, Pressable, Keyboard } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import SelectAsset from '@pages/SendTransaction/Step2Asset';
import SetAssetAmount from '@pages/SendTransaction/Step3Amount/SetAssetAmount';
import ArrowRigiht from '@assets/icons/arrow-right2.svg';

interface Props {
  selectedAsset: AssetInfo | null;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  amount: string;
  onConfirm: (params: { asset: AssetInfo; amount?: string }) => void;
  onClose: () => void;
}

const ReceiveSetAsset: React.FC<Props> = ({ onConfirm, selectedAsset, setSelectedAsset, amount, onClose }) => {
  const { colors } = useTheme();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const [showSelectAsset, setShowSelectAsset] = useState(() => !selectedAsset);
  const currentAddressValue = useCurrentAddressValue()!;

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.large} index={0} onClose={onClose} style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Receive</Text>

        <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>Select a token</Text>
        <Pressable
          style={({ pressed }) => [styles.assetWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={() => setShowSelectAsset(true)}
        >
          {selectedAsset && (
            <>
              <TokenIcon style={styles.assetIcon} source={selectedAsset?.icon} />
              <Text style={[styles.assetSymbol, { color: colors.textPrimary }]}>{selectedAsset.symbol}</Text>
              {selectedAsset.name !== selectedAsset.symbol && <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{selectedAsset.name}</Text>}
              <ArrowRigiht color={colors.iconPrimary} style={styles.assetArrow} />
            </>
          )}
          {!selectedAsset && <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>Click Here to select</Text>}
        </Pressable>

        {selectedAsset && (
          <>
            <Text style={[styles.text, styles.amount, { color: colors.textSecondary }]}>Amount</Text>
            <SetAssetAmount targetAddress={currentAddressValue} asset={selectedAsset} isReceive defaultAmount={amount}>
              {({ amount, isAmountValid }) => (
                <Button
                  testID="continue"
                  style={styles.btn}
                  disabled={!!amount && isAmountValid !== true}
                  size="small"
                  onPress={() => {
                    if (Keyboard.isVisible()) {
                      Keyboard.dismiss();
                      setTimeout(() => bottomSheetRef.current?.close(), 188);
                    } else {
                      bottomSheetRef.current?.close();
                    }
                    onConfirm({ asset: selectedAsset, amount });
                  }}
                >
                  Continue
                </Button>
              )}
            </SetAssetAmount>
          </>
        )}
        {!selectedAsset && (
          <Button style={styles.btn} size="small" onPress={() => setShowSelectAsset(true)}>
            Select Asset
          </Button>
        )}
      </BottomSheet>
      {showSelectAsset && <SelectAsset selectType="Receive" onConfirm={(asset) => setSelectedAsset(asset)} onClose={() => setShowSelectAsset(false)} />}
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
  assetArrow: {
    position: 'absolute',
    right: 16,
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
