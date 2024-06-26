import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RouteProp, useRoute, useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTranslation } from 'react-i18next';
import { toUtf8String } from 'ethers';
import { Image } from 'expo-image';
import {
  VaultType,
  useCurrentAccount,
  useCurrentAddressValue,
  useCurrentNetwork,
  useCurrentAddress,
  useVaultOfAccount,
} from '@core/WalletCore/Plugins/ReactInject';
import { WalletConnectParamList, WalletConnectSignMessageStackName } from '@router/configs';
import { type IWCSignMessageEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import { shortenAddress } from '@core/utils/address';
import { WalletConnectRPCMethod } from '@core/WalletCore/Plugins/WalletConnect/types';
import plugins from '@core/WalletCore/Plugins';
import methods from '@core/WalletCore/Methods';
import Text from '@components/Text';
import BottomSheet, { snapPoints, BottomSheetScrollView, BottomSheetView } from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import { sanitizeTypedData } from '@utils/santitizeTypedData';
import { toDataUrl } from '@utils/blockies';
import useInAsync from '@hooks/useInAsync';
import Copy from '@assets/icons/copy.svg';
import { SignType } from '@core/database/models/Signature/type';

function WalletConnectSignMessage() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddress()!;
  const currentAddressValue = useCurrentAddressValue();
  const currentNetwork = useCurrentNetwork();
  const vault = useVaultOfAccount(currentAccount?.id);

  const {
    params: {
      metadata: { icons = [], name = '', url },
      message,
      method,
    },
  } = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectSignMessageStackName>>();

  const signMsg = useMemo(() => {
    let m = message;
    if (method === WalletConnectRPCMethod.PersonalSign) {
      try {
        m = toUtf8String(message);
      } catch {
        return '';
      }
    }

    if (method.startsWith(WalletConnectRPCMethod.SignTypedData)) {
      try {
        const parsedMessage = JSON.parse(m);
        const sanitizedMessage = sanitizeTypedData(parsedMessage);
        m = JSON.stringify(sanitizedMessage, null, 4);
      } catch (error) {
        return '';
      }
    }

    return m;
  }, [message, method]);

  const handleCoy = useCallback(
    (value: string) => {
      Clipboard.setString(value);
      showMessage({
        message: t('common.copied'),
        type: 'success',
        duration: 1500,
        width: 160,
      });
    },
    [t],
  );

  const _handleReject = useCallback(async () => {
    try {
      console.log('reject start');
      await plugins.WalletConnect.currentEventSubject.getValue()?.action.reject();
      console.log('reject end');
    } catch (err) {
      console.log('error', err);
    }
  }, []);

  const approve = useCallback<IWCSignMessageEvent['action']['approve']>(
    async (hex) => {
      const app = url ? await methods.queryAppByIdentity(url) : null;
      await methods.createSignature({
        address: currentAddress,
        app: app ? app : undefined,
        signType: method.startsWith(WalletConnectRPCMethod.SignTypedData) ? SignType.JSON : SignType.STR,
        message: message,
      });

      (plugins.WalletConnect.currentEventSubject.getValue()?.action.approve as IWCSignMessageEvent['action']['approve'])(hex);
    },
    [currentAddress, message, method, url],
  );

  const _handleApprove = useCallback(async () => {
    if (!message) return;
    if (!currentAddressValue || !currentAddress || !vault || !currentNetwork) return;

    const vaultType = vault.type;

    if (method === WalletConnectRPCMethod.PersonalSign) {
      try {
        if (vaultType === VaultType.BSIM) {
          const [res] = await plugins.BSIM.signMessage(signMsg, currentAddressValue);
          const hex = (await res).serialized;
          await approve(hex);
        } else {
          const pk = await methods.getPrivateKeyOfAddress(currentAddress);
          const hex = await plugins.Transaction.signMessage({ message: signMsg, privateKey: pk, network: currentNetwork });
          await approve(hex);
        }
      } catch (error) {
        console.log('personal_sign error', error);
      }
    } else if (method.startsWith(WalletConnectRPCMethod.SignTypedData)) {
      try {
        const m = JSON.parse(message);

        if (vaultType === VaultType.BSIM) {
          const [res] = await plugins.BSIM.signTypedData(m.domain, m.types, m.message, currentAddressValue);
          const hex = (await res).serialized;
          await approve(hex);
        } else {
          const pk = await methods.getPrivateKeyOfAddress(currentAddress);
          const hex = await plugins.Transaction.signTypedData({ domain: m.domain, types: m.types, value: m.message, network: currentNetwork, privateKey: pk });
          await approve(hex);
        }
      } catch (error) {
        console.log('eth_signTypedData error', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNetwork, currentAddress?.id, message, method, vault, signMsg]);

  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);
  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);

  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.large} onClose={handleReject}>
      <BottomSheetView style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wc.request.signature')}</Text>

        <View style={[styles.subTitle, styles.flexWithRow]}>
          <Icon source={icons[0]} width={32} height={32} style={{ borderRadius: 8 }} />
          <View>
            <Text style={styles.method}>{t('wc.sign.signData')}</Text>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{name}</Text>
          </View>
        </View>

        <BottomSheetView style={styles.contentHeight}>
          <BottomSheetScrollView
            style={[styles.content, { borderColor: colors.borderFourth }]}
            stickyHeaderIndices={[0]}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <Pressable onPress={() => handleCoy(signMsg)} testID="copy">
              <View style={[styles.flexWithRow, styles.scrollTitle, { backgroundColor: colors.bgFourth }]}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('wc.sign.message')}</Text>
                <Copy width={18} height={18} color={colors.textSecondary} />
              </View>
            </Pressable>
            <Text style={{ color: colors.textPrimary }}>{signMsg}</Text>
          </BottomSheetScrollView>
        </BottomSheetView>

        <View style={[styles.footer, { borderColor: colors.borderFourth }]}>
          <View style={[styles.flexWithRow, styles.account]}>
            <View style={[styles.flexWithRow, styles.accountLeft]}>
              <Image style={styles.accountIcon} source={{ uri: toDataUrl(currentAddressValue) }} />
              <View>
                <Text numberOfLines={3} style={[styles.h2, { color: colors.textPrimary, maxWidth: 150 }]}>
                  {currentAccount?.nickname}
                </Text>
                <Text style={[styles.address, { color: colors.textSecondary }]}>{shortenAddress(currentAddressValue)}</Text>
              </View>
            </View>
            <Text style={{ color: colors.textPrimary }}>{t('wc.sign.network', { network: currentNetwork?.name })}</Text>
          </View>
        </View>
        <View style={[styles.buttons, styles.flexWithRow]}>
          <Button style={styles.btn} testID="reject" onPress={handleReject} loading={rejectLoading}>
            {t('common.cancel')}
          </Button>
          <Button style={styles.btn} testID="approve" onPress={handleApprove} loading={approveLoading}>
            {t('common.confirm')}
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flexWithRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  h2: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
  },
  subTitle: {
    paddingHorizontal: 16,
    gap: 8,
  },
  method: {
    fontSize: 12,
    fontWeight: '300',
  },
  contentHeight: {
    height: 300,
  },
  content: {
    marginHorizontal: 16,
    marginVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    height: 300,
  },
  scrollTitle: {
    paddingVertical: 16,
    gap: 8,
  },
  scroll: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  account: {
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  accountLeft: { gap: 8, alignItems: 'center' },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  address: {
    fontSize: 12,
    fontWeight: '300',
  },
  buttons: {
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 'auto',
    marginBottom: 100,
  },
  btn: {
    flex: 1,
  },
});

export default WalletConnectSignMessage;
