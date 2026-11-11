import Copy from '@assets/icons/copy.svg';
import Button from '@components/Button';
import Icon from '@components/Icon';
import { PlaintextMessage } from '@components/PlaintextMessage';
import { SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { BSIM_ERROR_CANCEL } from '@core/hardware/bsim/constants';
import { SignType } from '@core/services/signing/types';
import { parseSignMessageParameters, parseSignTypedDataParameters } from '@core/services/transaction';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import HardwareSignVerify from '@pages/SendTransaction/HardwareSignVerify';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import { useHardwareSigningUiState } from '@pages/SendTransaction/Step4Confirm/useHardwareSigningUiState';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '@react-navigation/native';
import type { StackScreenProps, WalletConnectSignMessageStackName } from '@router/configs';
import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { getExternalRequestsService, getSignatureRecordService, getSigningService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import { sanitizeTypedData } from '@utils/santitizeTypedData';
import { isHexString, toUtf8String } from 'ethers';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

const isUserCanceledError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === AUTH_PASSWORD_REQUEST_CANCELED) return true;
  if (code === BSIM_ERROR_CANCEL) return true;

  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'AbortError') return true;

  return false;
};

function WalletConnectSignMessage({ navigation, route }: StackScreenProps<typeof WalletConnectSignMessageStackName>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: currentAccount } = useCurrentAccount();
  const { data: currentAddress } = useCurrentAddress();
  const { data: currentNetwork } = useCurrentNetwork();
  const { requestId, request } = route.params;

  const metadata = request?.metadata ?? { name: '', url: '' };
  const icons = Array.isArray(metadata.icons) ? metadata.icons : [];
  const name = metadata.name ?? '';
  const url = metadata.url ?? request?.origin ?? '';

  const method = request?.method ?? 'personal_sign';

  const signingAbortRef = useRef<AbortController | null>(null);
  const requestSettledRef = useRef(false);
  const addressId = currentAddress?.id ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);

  const signMsg = useMemo(() => {
    if (!request) return '';

    if (method === 'personal_sign') {
      const parsed = parseSignMessageParameters(request.params);
      const raw = typeof parsed.message === 'string' ? parsed.message : parsed.message.raw;

      if (isHexString(raw)) {
        try {
          return toUtf8String(raw);
        } catch (e) {
          console.log('error:', e);
        }
      }
      return raw;
    }

    // eth_signTypedData_v4
    try {
      const parsed = parseSignTypedDataParameters(request.params);
      const sanitized = sanitizeTypedData(parsed.typedData);
      return JSON.stringify(sanitized, null, 4);
    } catch {
      return '';
    }
  }, [method, request]);
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
    if (requestSettledRef.current) return;
    navigation.goBack();
  }, [navigation]);

  useEffect(
    () => () => {
      signingAbortRef.current?.abort();
      if (requestSettledRef.current) return;
      requestSettledRef.current = true;
      try {
        getExternalRequestsService().reject({ requestId });
      } catch (error) {
        console.log(error);
      }
    },
    [requestId],
  );

  const finalizeApprove = useCallback(
    (result: string) => {
      clearHardwareSignState();
      if (requestSettledRef.current || !navigation.isFocused()) return;
      requestSettledRef.current = true;
      navigation.goBack();
      try {
        getExternalRequestsService().approve({ requestId, data: { result } });
      } catch (error) {
        showMessage({
          message: matchRPCErrorMessage(error as { message?: string; data?: string; code?: number }),
          type: 'danger',
        });
      }
    },
    [clearHardwareSignState, navigation, requestId],
  );

  const _handleApprove = useCallback(async () => {
    if (!requestId || !request) return;
    if (!currentAccount?.id || !currentAddress?.id || !currentAddress.value || !currentNetwork) return;
    if (signingAbortRef.current || requestSettledRef.current) return;

    clearHardwareSignState();

    const controller = new AbortController();
    signingAbortRef.current = controller;

    if (method === 'personal_sign') {
      try {
        const parsed = parseSignMessageParameters(request.params);
        const signature = await getSigningService().signPersonalMessage({
          accountId: currentAccount.id,
          addressId: currentAddress.id,
          request: parsed,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        try {
          const raw = typeof parsed.message === 'string' ? parsed.message : parsed.message.raw;
          await getSignatureRecordService().createRecord({
            addressId: currentAddress.id,
            signType: SignType.STR,
            message: raw,
            app: url
              ? {
                  identity: url,
                  origin: url,
                  name: name || url,
                  icon: icons[0],
                }
              : null,
          });
        } catch {
          // do not block approval
        }

        if (controller.signal.aborted) return;
        finalizeApprove(signature);
      } catch (error: unknown) {
        console.log('personal_sign error', error);
        if (controller.signal.aborted) return;

        if (
          handleBSIMHardwareUnavailable(error, navigation, {
            beforeNavigate: () => {
              clearHardwareSignState();
              signingAbortRef.current?.abort();
            },
          })
        ) {
          return;
        }
        if (isUserCanceledError(error)) {
          clearHardwareSignState();
          return;
        }

        clearHardwareSignState();
        showMessage({
          message: matchRPCErrorMessage(error as { message?: string; data?: string; code?: number }),
          type: 'danger',
        });
      } finally {
        signingAbortRef.current = null;
      }
    } else {
      try {
        const parsed = parseSignTypedDataParameters(request.params);
        const signature = await getSigningService().signTypedDataV4({
          accountId: currentAccount.id,
          addressId: currentAddress.id,
          request: parsed,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        try {
          await getSignatureRecordService().createRecord({
            addressId: currentAddress.id,
            signType: SignType.JSON,
            message: JSON.stringify(parsed.typedData),
            app: url
              ? {
                  identity: url,
                  origin: url,
                  name: name || url,
                  icon: icons[0],
                }
              : null,
          });
        } catch {
          // do not block approval
        }

        if (controller.signal.aborted) return;
        finalizeApprove(signature);
      } catch (error: unknown) {
        console.log('eth_signTypedData error', error);
        if (controller.signal.aborted) return;
        if (
          handleBSIMHardwareUnavailable(error, navigation, {
            beforeNavigate: () => {
              clearHardwareSignState();
              signingAbortRef.current?.abort();
            },
          })
        ) {
          return;
        }
        if (isUserCanceledError(error)) {
          clearHardwareSignState();
          return;
        }

        clearHardwareSignState();
        showMessage({
          message: matchRPCErrorMessage(error as { message?: string; data?: string; code?: number }),
          type: 'danger',
        });
      } finally {
        signingAbortRef.current = null;
      }
    }
  }, [
    clearHardwareSignState,
    currentAccount?.id,
    currentAddress?.id,
    currentAddress?.value,
    currentNetwork,
    icons,
    method,
    name,
    navigation,
    request,
    requestId,
    url,
    finalizeApprove,
  ]);

  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);
  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);

  const { shownMessage, jsonMessage } = useMemo(() => {
    let jsonMessage: Record<string, unknown> = {};
    let shownMessage = signMsg ?? '';
    try {
      if (method !== 'personal_sign') {
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
    if (method === 'personal_sign') {
      return <Text style={{ color: colors.textPrimary }}>{shownMessage}</Text>;
    }
    return <PlaintextMessage data={jsonMessage} />;
  }, [shownMessage, jsonMessage, method, colors.textPrimary]);

  return (
    <View style={styles.container} collapsable={false}>
      <SheetHeader title={t('wc.request.signature')}>
        <View style={[styles.subTitle, styles.flexWithRow]}>
          <Icon source={icons[0]} width={32} height={32} style={{ borderRadius: 8 }} />
          <View>
            <Text style={[styles.method, { color: colors.textSecondary }]}>{t('wc.sign.signData')}</Text>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{name}</Text>
          </View>
        </View>
      </SheetHeader>
      <SheetScrollView style={[styles.content, { borderColor: colors.borderFourth }]} stickyHeaderIndices={[0]}>
        <Pressable onPress={() => handleCoy(shownMessage)} testID="copy">
          <View style={[styles.flexWithRow, styles.scrollTitle, { backgroundColor: colors.bgFourth }]}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('wc.sign.message')}</Text>
            <Copy color={colors.textSecondary} />
          </View>
        </Pressable>
        <View style={{ marginBottom: 16 }}>{renderMessage()}</View>
        <HardwareSignVerify
          state={currentAccount?.isHardwareWallet ? hardwareSignState : null}
          onClose={() => {
            signingAbortRef.current?.abort();
            clearHardwareSignState();
          }}
          onRetry={handleApprove}
        />
      </SheetScrollView>

      <SheetFooter style={[styles.footer, { borderColor: colors.borderFourth }]}>
        <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAccount?.address ?? ''}>
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
      </SheetFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    paddingHorizontal: 0,
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
