import PoundKey from '@assets/icons/pound-key.svg';
import Share from '@assets/icons/share.svg';
import Logo from '@assets/images/swift-shield-QRCode.webp';
import BottomSheet, { snapPoints } from '@components/BottomSheet';
import Text from '@components/Text';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { NetworkType, useCurrentAccount, useCurrentAddressValue, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { trimDecimalZeros } from '@core/utils/balance';
import { numberWithCommas } from '@core/utils/balance';
import { AccountItemView } from '@modules/AccountsList';
import { Navigation } from '@pages/Home/Navigations';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '@react-navigation/native';
import type { ReceiveStackName, StackScreenProps } from '@router/configs';
import { encodeETHURL } from '@utils/ETHURL';
import { isSmallDevice } from '@utils/deviceInfo';
import Decimal from 'decimal.js';
/* eslint-disable react-hooks/exhaustive-deps */
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import QRCode from 'react-native-qrcode-svg';
import ReceiveSetAsset from './ReceiveSetAsset';

interface Props {
  navigation: StackScreenProps<typeof ReceiveStackName>['navigation'];
}

const Receive: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
      <BottomSheet snapPoints={snapPoints.large} isRoute style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('receive.title')}</Text>
        <Text style={[styles.tip, { color: colors.textPrimary }]}>{t('receive.describe', { netName: currentNetwork?.name })}</Text>

        <View style={[styles.qrcodeWrapper, { backgroundColor: colors.bgSecondary, paddingBottom: selectedAsset ? 18 : 30 }]}>
          <QRCode value={ethUrl} size={172} logo={Logo} logoSize={40} logoBackgroundColor="transparent" />
          {selectedAsset && (
            <>
              <Text style={[styles.receive, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                {numberWithCommas(amount)} {selectedAsset?.symbol}{' '}
              </Text>
              {price && price !== '0' && (
                <Text style={[styles.price, { color: colors.textSecondary }]} numberOfLines={1}>
                  ≈ ${numberWithCommas(price)}
                </Text>
              )}
              {}
            </>
          )}
        </View>

        <View style={styles.accountWrapper}>
          <AccountItemView
            nickname={currentAccount?.nickname}
            addressValue={currentAddressValue}
            colors={colors}
            shorten={false}
            showCopy
            showUnderlay={false}
            onPress={() => {
              Clipboard.setString(currentAddressValue);
              showMessage({
                message: t('common.copied'),
                type: 'success',
                duration: 1500,
                width: 160,
              });
            }}
          />
        </View>

        <View style={styles.btnWrapper}>
          {/* <Navigation
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
            /> */}
          <Navigation title={t('receive.selectAsset')} Icon={PoundKey} onPress={() => setShowSetAsset(true)} />
        </View>
      </BottomSheet>
      {showSetAsset && (
        <ReceiveSetAsset
          selectedAsset={selectedAsset}
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
  },
  title: {
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  tip: {
    alignSelf: 'center',
    marginBottom: 24,
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
    width: 220,
    borderRadius: 8,
    paddingTop: 30,
  },
  receive: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    maxWidth: 172,
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
    marginTop: isSmallDevice ? 'auto' : 102,
    marginBottom: isSmallDevice ? 48 : 0,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 38,
  },
});

export default Receive;
