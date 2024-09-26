import { BSIMError } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import { BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import Copy from '@assets/icons/copy.svg';
import BottomSheet, { snapPoints, BottomSheetWrapper, BottomSheetHeader, BottomSheetScrollContent, BottomSheetFooter } from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import {
  VaultType,
  useCurrentAccount,
  useCurrentAddress,
  useCurrentAddressValue,
  useCurrentNetwork,
  useVaultOfAccount,
} from '@core/WalletCore/Plugins/ReactInject';
import type { IWCSignMessageEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import { WalletConnectRPCMethod } from '@core/WalletCore/Plugins/WalletConnect/types';
import { SignType } from '@core/database/models/Signature/type';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import BSIMVerify, { useBSIMVerify } from '@pages/SendTransaction/BSIMVerify';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import Clipboard from '@react-native-clipboard/clipboard';
import { type RouteProp, useRoute, useTheme } from '@react-navigation/native';
import type { WalletConnectParamList, WalletConnectSignMessageStackName } from '@router/configs';
import { sanitizeTypedData } from '@utils/santitizeTypedData';
import { isHexString, toUtf8String } from 'ethers';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { PlaintextMessage } from '@components/PlaintextMessage';

function WalletConnectSignMessage() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddress()!;
  BSIMVerify;
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
    let decodeMsg = message;
    if (method === WalletConnectRPCMethod.PersonalSign) {
      const isHex = isHexString(decodeMsg);
      if (isHex) {
        try {
          decodeMsg = toUtf8String(message);
        } catch (e) {
          console.log('error:', e);
        }
      }
      return decodeMsg;
    }

    if (method.startsWith(WalletConnectRPCMethod.SignTypedData)) {
      try {
        const parsedMessage = JSON.parse(decodeMsg);
        const sanitizedMessage = sanitizeTypedData(parsedMessage);

        decodeMsg = JSON.stringify(sanitizedMessage, null, 4);
      } catch (error) {
        return '';
      }
    }

    return decodeMsg;
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
      await plugins.WalletConnect.currentEventSubject.getValue()?.action.reject();
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

  const { bsimEvent, setBSIMEvent, execBSIMCancel, setBSIMCancel } = useBSIMVerify();
  const _handleApprove = useCallback(async () => {
    if (!message) return;
    if (!currentAddressValue || !currentAddress || !vault || !currentNetwork) return;
    setBSIMEvent(null);
    execBSIMCancel();

    const vaultType = vault.type;
    if (vaultType === VaultType.BSIM) {
      setBSIMEvent({ type: BSIMEventTypesName.BSIM_SIGN_START });
    }

    if (method === WalletConnectRPCMethod.PersonalSign) {
      try {
        if (vaultType === VaultType.BSIM) {
          const [res, cancel] = await plugins.BSIM.signMessage(signMsg, currentAddressValue);
          setBSIMCancel(cancel);
          const hex = (await res).serialized;
          await approve(hex);
          setBSIMEvent(null);
        } else {
          const pk = await methods.getPrivateKeyOfAddress(currentAddress);
          const hex = await plugins.Transaction.signMessage({ message: signMsg, privateKey: pk, network: currentNetwork });
          await approve(hex);
        }
      } catch (error) {
        console.log('personal_sign error', error);
        if (error instanceof BSIMError) {
          setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error?.message });
        }
      }
    } else if (method.includes('signTypedData')) {
      try {
        const m = JSON.parse(message);

        if (vaultType === VaultType.BSIM) {
          const [res, cancel] = await plugins.BSIM.signTypedData(m.domain, m.types, m.message, currentAddressValue);
          setBSIMCancel(cancel);
          const hex = (await res).serialized;
          await approve(hex);
          setBSIMEvent(null);
        } else {
          const pk = await methods.getPrivateKeyOfAddress(currentAddress);
          const hex = await plugins.Transaction.signTypedData({ domain: m.domain, types: m.types, value: m.message, network: currentNetwork, privateKey: pk });
          await approve(hex);
        }
      } catch (error) {
        console.log('eth_signTypedData error', error);
        if (error instanceof BSIMError) {
          setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error?.message });
        } else {
          setBSIMEvent(null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNetwork, currentAddress?.id, message, method, vault, signMsg]);

  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);
  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);

  const { shownMessage, jsonMessage } = useMemo(() => {
    let jsonMessage: any = {};
    let shownMessage = signMsg ?? '';
    try {
      if (method.includes('signTypedData')) {
        jsonMessage = JSON.parse(shownMessage).message || {};
        shownMessage = JSON.stringify(jsonMessage) ?? '';
      }
      return {
        shownMessage,
        jsonMessage,
      };
    } catch (error) {
      console.log('parse message error:', error);
      return {
        shownMessage,
        jsonMessage,
      };
    }
  }, [signMsg, method]);

  const renderMessage = useCallback(() => {
    if (method === WalletConnectRPCMethod.PersonalSign) {
      return <Text style={{ color: colors.textPrimary }}>{shownMessage}</Text>;
    }
    if (method.includes('signTypedData')) {
      return <PlaintextMessage data={jsonMessage} />;
    }
    return '';
  }, [shownMessage, jsonMessage, method, colors.textPrimary]);

  return (
    <>
      <BottomSheet
        enablePanDownToClose={!approveLoading}
        enableContentPanningGesture={!approveLoading}
        isRoute
        snapPoints={snapPoints.large}
        onClose={handleReject}
      >
        <BottomSheetWrapper>
          <BottomSheetHeader title={t('wc.request.signature')}>
            <View style={[styles.subTitle, styles.flexWithRow]}>
              <Icon source={icons[0]} width={32} height={32} style={{ borderRadius: 8 }} />
              <View>
                <Text style={[styles.method, { color: colors.textSecondary }]}>{t('wc.sign.signData')}</Text>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>{name}</Text>
              </View>
            </View>
          </BottomSheetHeader>
          <BottomSheetScrollContent style={[styles.content, { borderColor: colors.borderFourth }]} stickyHeaderIndices={[0]}>
            <Pressable onPress={() => handleCoy(shownMessage)} testID="copy">
              <View style={[styles.flexWithRow, styles.scrollTitle, { backgroundColor: colors.bgFourth }]}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('wc.sign.message')}</Text>
                <Copy color={colors.textSecondary} />
              </View>
            </Pressable>
            <View style={{ marginBottom: 16 }}>{renderMessage()}</View>
          </BottomSheetScrollContent>

          <BottomSheetFooter style={[styles.footer, { borderColor: colors.borderFourth }]}>
            <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAddressValue ?? ''} colors={colors}>
              <Text style={[transactionConfirmStyle.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
                on {currentNetwork?.name}
              </Text>
            </AccountItemView>

            <View style={styles.btnArea}>
              <Button style={styles.btn} testID="reject" onPress={handleReject} loading={rejectLoading}>
                {t('common.cancel')}
              </Button>
              <Button style={styles.btn} testID="approve" onPress={handleApprove} loading={approveLoading}>
                {t('common.confirm')}
              </Button>
            </View>
          </BottomSheetFooter>
        </BottomSheetWrapper>
      </BottomSheet>
      {bsimEvent && (
        <BSIMVerify
          bsimEvent={bsimEvent}
          onClose={() => {
            setBSIMEvent(null);
            execBSIMCancel();
          }}
          onRetry={handleApprove}
        />
      )}
    </>
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
  subTitle: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  method: {
    fontSize: 12,
    fontWeight: '300',
  },
  content: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  scrollTitle: {
    paddingVertical: 16,
    gap: 8,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 24,
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default WalletConnectSignMessage;
