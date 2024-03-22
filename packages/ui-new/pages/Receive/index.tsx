import React, { useState, useMemo } from 'react';
import { useTheme } from '@react-navigation/native';
import { View, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import Decimal from 'decimal.js';
import { useCurrentAccount, useCurrentNetwork, useCurrentAddressValue, NetworkType } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { ReceiveStackName, type StackScreenProps } from '@router/configs';
import { AccountItemView } from '@modules/AccountsList';
import BottomSheet, { snapPoints, BottomSheetScrollView, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import { Navigation } from '@pages/Home/Navigations';
import { encodeETHURL } from '@utils/ETHURL';
import { trimDecimalZeros } from '@core/utils/balance';
import Logo from '@assets/icons/logo.png';
import Share from '@assets/icons/share.svg';
import PoundKey from '@assets/icons/pound-key.svg';
import ReceiveSetAsset from './ReceiveSetAsset';

interface Props {
  navigation: StackScreenProps<typeof ReceiveStackName>['navigation'];
}

const Receive: React.FC<Props> = ({ navigation }) => {
  const { colors, mode } = useTheme();
  const [showSetAsset, setShowSetAsset] = useState(false);

  const currentAccount = useCurrentAccount()!;
  const currentNetwork = useCurrentNetwork()!;
  const currentAddressValue = useCurrentAddressValue()!;

  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [amount, setAmount] = useState<string>('');
  const price = useMemo(
    () => (!selectedAsset?.priceInUSDT ? null : trimDecimalZeros(new Decimal(selectedAsset.priceInUSDT || 0).mul(new Decimal(amount || 0)).toFixed(2))),
    [selectedAsset?.priceInUSDT, amount],
  );

  const ethUrl = useMemo(
    () =>
      encodeETHURL({
        target_address: currentAddressValue,
        schema_prefix: currentNetwork.networkType === NetworkType.Conflux ? 'conflux' : 'ethereum',
        chain_id: currentNetwork.chainId,
        ...(selectedAsset && {
          function_name: 'transfer',
          parameters: {
            ...(selectedAsset?.contractAddress && { address: selectedAsset?.contractAddress }),
            ...(amount && amount !== '0' && { value: new Decimal(amount || 0).mul(Decimal.pow(10, selectedAsset.decimals ?? 0)).toHex() }),
          },
        }),
      }),
    [selectedAsset?.contractAddress, amount, currentAddressValue, currentNetwork.chainId, selectedAsset?.decimals, currentNetwork.networkType],
  );

  return (
    <>
      <BottomSheet snapPoints={snapPoints.large} isRoute>
        <BottomSheetScrollView style={styles.container}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Receive</Text>
          <Text style={[styles.tip, { color: colors.textPrimary }]}>Only send {currentNetwork?.name} network assets to this address.</Text>

          <View style={[styles.qrcodeWrapper, { backgroundColor: colors.bgSecondary, paddingBottom: selectedAsset ? 18 : 30 }]}>
            <QRCode value={ethUrl} size={220} logo={Logo} logoSize={60} logoBackgroundColor="transparent" />
            {selectedAsset && (
              <>
                <Text style={[styles.receive, { color: colors.textPrimary }]}>
                  {amount} {selectedAsset?.symbol}{' '}
                </Text>
                {price && price !== '0' && (
                  <Text style={[styles.price, { color: colors.textSecondary }]} numberOfLines={1}>
                    ≈ ${price}
                  </Text>
                )}
                {}
              </>
            )}
          </View>

          <View style={styles.accountWrapper}>
            <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAddressValue} colors={colors} mode={mode} shorten={false} />
          </View>

          <View style={styles.btnWrapper}>
            <Navigation
              title="Share"
              Icon={Share}
              onPress={() => {
                Clipboard.setString(ethUrl);
                showMessage({
                  message: 'Copied!',
                  type: 'success',
                  duration: 1500,
                  width: 160,
                });
              }}
            />
            <Navigation title="Set amount" Icon={PoundKey} onPress={() => setShowSetAsset(true)} />
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
      {showSetAsset && (
        <ReceiveSetAsset
          selectedAsset={selectedAsset}
          setSelectedAsset={setSelectedAsset}
          amount={amount}
          onConfirm={({ asset, amount }) => {
            setSelectedAsset(asset);
            if (amount) {
              setAmount(amount);
            }
          }}
          onClose={() => setShowSetAsset(false)}
        />
      )}
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
  tip: {
    alignSelf: 'center',
    marginBottom: 16,
    width: 280,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  qrcodeWrapper: {
    alignSelf: 'center',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 280,
    borderRadius: 8,
    paddingTop: 30,
  },
  receive: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  price: {
    fontSize: 14,
    lineHeight: 22,
  },
  accountWrapper: {
    alignSelf: 'center',
    marginTop: 24,
    width: 280,
  },
  btnWrapper: {
    marginTop: 102,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 38,
  },
});

export default Receive;
