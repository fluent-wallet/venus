import ScanBorder from '@assets/icons/scan-border.svg';
import BottomSheet, {
  type BottomSheetMethods,
  snapPoints,
  BottomSheetWrapper,
  BottomSheetHeader,
  BottomSheetContent,
  BottomSheetFooter,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Spinner from '@components/Spinner';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { AssetType, NetworkType, getAssetsTokenList, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { WalletConnectPluginError } from '@core/WalletCore/Plugins/WalletConnect';
import { StackActions, useTheme } from '@react-navigation/native';
import {
  SendTransactionStackName,
  SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  ExternalInputHandlerStackName,
  type StackScreenProps,
  type StackNavigation,
} from '@router/configs';
import { type ETHURL, parseETHURL } from '@utils/ETHURL';
import Decimal from 'decimal.js';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import useQRCodeScan from './useQRCodeScan';

// has onConfirm props means open in SendTransaction with local modal way.
interface Props extends Partial<StackScreenProps<typeof ExternalInputHandlerStackName>> {
  onConfirm?: (ethUrl: ETHURL) => void;
  onClose?: () => void;
}

enum ScanStatusType {
  ConnectingWC = 'connecting-wc',
}

export const useListenDeepLink = (navigation: StackNavigation) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const data = event.url;
      const hasCurrentWCEvent = plugins.WalletConnect.currentEventSubject.getValue() !== undefined;
      if (hasCurrentWCEvent) return;
      navigation.navigate(ExternalInputHandlerStackName, { data });
    };

    Linking.getInitialURL().then((url) => url && handleDeepLink({ url }));
    const urlListener = Linking.addEventListener('url', handleDeepLink);

    return () => {
      urlListener.remove();
    };
  }, []);
};

const scanAreaWidth = 220;
const ExternalInputHandler: React.FC<Props> = ({ navigation, onConfirm, onClose, route }) => {
  const { colors, reverseColors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork()!;
  const isParsingRef = useRef(false);

  const [parseStatus, setParseStatus] = useState<{ type?: string; message: string } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const onParseEthUrlSuccess = useCallback(
    async (ethUrl: ETHURL) => {
      if (onConfirm) {
        onConfirm(ethUrl);
        bottomSheetRef?.current?.close();
        return;
      }
      if (navigation) {
        if (
          (currentNetwork.networkType === NetworkType.Conflux && ethUrl.schema_prefix === 'ethereum:') ||
          (currentNetwork.networkType === NetworkType.Ethereum && ethUrl.schema_prefix === 'conflux:')
        ) {
          setParseStatus({ message: t('scan.parse.error.missChianTypes') });
          return;
        }

        if (ethUrl.chain_id && ethUrl.parameters && ethUrl.chain_id !== currentNetwork.chainId) {
          setParseStatus({ message: t('scan.parse.error.missChianId') });
          return;
        }

        if (!(await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: ethUrl.target_address }))) {
          setParseStatus({ message: t('scan.parse.error.invalidTargetAddress') });
          return;
        }
        if (!ethUrl.function_name) {
          navigation.dispatch(
            StackActions.replace(SendTransactionStackName, { screen: SendTransactionStep2StackName, params: { recipientAddress: ethUrl.target_address } }),
          );
          return;
        }
        if (ethUrl.function_name === 'transfer') {
          const allAssetsTokens = getAssetsTokenList();
          if (!allAssetsTokens?.length) {
            navigation.dispatch(
              StackActions.replace(SendTransactionStackName, { screen: SendTransactionStep2StackName, params: { recipientAddress: ethUrl.target_address } }),
            );
            return;
          }

          const targetAsset = !ethUrl.parameters?.address
            ? allAssetsTokens?.find((asset) => asset.type === AssetType.Native)
            : allAssetsTokens?.find((asset) => asset.contractAddress === ethUrl.parameters?.address);

          if (!targetAsset) {
            if (ethUrl.parameters?.address) {
              navigation.dispatch(
                StackActions.replace(SendTransactionStackName, {
                  screen: SendTransactionStep2StackName,
                  params: { recipientAddress: ethUrl.target_address, searchAddress: ethUrl.parameters?.address },
                }),
              );
            } else {
              setParseStatus({ message: 'Unvalid ETHURL.' });
            }
          } else {
            if (ethUrl.parameters?.value) {
              navigation.dispatch(
                StackActions.replace(SendTransactionStackName, {
                  screen: SendTransactionStep4StackName,
                  params: {
                    recipientAddress: ethUrl.target_address,
                    asset: targetAsset,
                    amount: new Decimal(String(ethUrl.parameters?.value)).div(Decimal.pow(10, targetAsset.decimals ?? 18)).toString(),
                  },
                }),
              );
            } else {
              navigation.dispatch(
                StackActions.replace(SendTransactionStackName, {
                  screen: SendTransactionStep3StackName,
                  params: { recipientAddress: ethUrl.target_address, asset: targetAsset },
                }),
              );
            }
          }
        }
      }
    },
    [onConfirm, currentNetwork?.id],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleParse = useCallback(
    async (dataString: string) => {
      isParsingRef.current = true;
      let ethUrl: ETHURL;
      if (await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: dataString })) {
        ethUrl = { target_address: dataString, schema_prefix: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum:' : 'conflux:' } as ETHURL;
        onParseEthUrlSuccess(ethUrl);
        isParsingRef.current = false;
        return;
      }

      try {
        if (!onConfirm && dataString.startsWith('wc:')) {
          setParseStatus({ type: ScanStatusType.ConnectingWC, message: t('wc.connecting') });
          await plugins.WalletConnect.connect({ wcURI: dataString });
        } else {
          ethUrl = parseETHURL(dataString);
          onParseEthUrlSuccess(ethUrl);
          isParsingRef.current = false;
        }
      } catch (err) {
        isParsingRef.current = false;
        if (err instanceof WalletConnectPluginError) {
          if (err.message === 'VersionNotSupported') {
            setParseStatus({ message: t('scan.walletConnect.error.lowVersion') });
          } else if (err.message === 'PairingAlreadyExists') {
            setParseStatus({ message: t('scan.walletConnect.error.pairingAlreadyExists') });
          } else {
            setParseStatus({ message: `${t('scan.walletConnect.error.connectFailed')} ${String(err ?? '')}` });
          }
        } else {
          setParseStatus({ message: t('scan.QRCode.error.notRecognized') });
        }
      }
    },
    [onConfirm, onParseEthUrlSuccess, currentNetwork?.id],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const onScanQrCodeFailed = useCallback(() => setParseStatus({ message: t('scan.QRCode.error.notRecognized') }), []);
  const { hasCameraPermission, hasRejectCameraPermission, checkCameraPermission, pickImage, Camera } = useQRCodeScan({
    style: styles.camera,
    onSuccess: handleParse,
    onFailed: onScanQrCodeFailed,
    isParsingRef,
  });

  const externalData = route?.params?.data;

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (externalData) {
      handleParse(externalData);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const onBottomSheetOpen = useCallback(() => {
    if (!externalData) {
      checkCameraPermission();
    }
  }, []);

  const isRoute = !onConfirm;
  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={externalData ? snapPoints.percent40 : snapPoints.large}
      isRoute={!onConfirm}
      index={isRoute ? undefined : 0}
      onOpen={onBottomSheetOpen}
      onClose={isRoute ? undefined : onClose}
    >
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={externalData ? 'Linking' : t('scan.title')} />
        <BottomSheetContent>
          {!externalData && hasCameraPermission && (
            <>
              <View style={styles.cameraWrapper}>
                {parseStatus?.type !== ScanStatusType.ConnectingWC && Camera}
                {parseStatus?.type === ScanStatusType.ConnectingWC && (
                  <>
                    <View style={styles.cameraMask} />
                    <Spinner style={{ position: 'absolute' }} width={68} height={68} color={reverseColors.iconPrimary} backgroundColor={colors.iconPrimary} />
                  </>
                )}
              </View>
              <ScanBorder style={styles.scanBorder} color={colors.borderFourth} pointerEvents="none" />
            </>
          )}
          {(externalData || hasCameraPermission) && parseStatus?.message && (
            <Text style={[styles.message, { color: parseStatus?.type === ScanStatusType.ConnectingWC ? colors.up : colors.down }]}>{parseStatus.message}</Text>
          )}

          {!externalData && !hasCameraPermission && (
            <>
              {!hasRejectCameraPermission && (
                <>
                  <Text style={[styles.tip, { color: colors.down, marginBottom: 8 }]}>{t('scan.permission.title')}</Text>
                  <Text style={[styles.tip, { color: colors.textPrimary }]}>{t('scan.permission.describe')}</Text>
                </>
              )}
              {hasRejectCameraPermission && (
                <>
                  <Text style={[styles.tip, { color: colors.textPrimary, marginBottom: 8 }]}>{t('scan.permission.reject.title')}</Text>
                  <Text style={[styles.tip, { color: colors.textPrimary }]}>
                    <Trans i18nKey={'scan.permission.reject.describe'}>
                      Unable to scan. Please <Text style={{ color: colors.down }}>open Camera</Text> in the system permission.
                    </Trans>
                  </Text>
                </>
              )}
            </>
          )}
        </BottomSheetContent>
        <BottomSheetFooter>
          {!externalData && hasCameraPermission && (
            <Button testID="photos" style={styles.photos} onPress={pickImage}>
              {t('scan.photos')}
            </Button>
          )}
          {!externalData && !hasCameraPermission && hasRejectCameraPermission && (
            <View style={styles.btnArea}>
              <Button
                testID="dismiss"
                style={styles.btn}
                onPress={() => {
                  if (bottomSheetRef?.current) {
                    bottomSheetRef.current.close();
                  } else {
                    if (navigation?.canGoBack()) {
                      navigation.goBack();
                    }
                  }
                }}
                size="small"
              >
                {t('common.dismiss')}
              </Button>
              <Button
                testID="openSettings"
                style={styles.btn}
                onPress={() => {
                  Linking.openSettings();
                }}
                size="small"
              >
                {t('scan.permission.reject.openSettings')}
              </Button>
            </View>
          )}
          {externalData && parseStatus && parseStatus?.type !== ScanStatusType.ConnectingWC && (
            <View style={styles.btnArea}>
              <Button
                testID="dismiss"
                style={styles.btn}
                onPress={() => {
                  if (bottomSheetRef?.current) {
                    bottomSheetRef.current.close();
                  } else {
                    if (navigation?.canGoBack()) {
                      navigation.goBack();
                    }
                  }
                }}
                size="small"
              >
                {t('common.dismiss')}
              </Button>
            </View>
          )}
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scanBorder: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
  },
  cameraWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 91,
    width: scanAreaWidth,
    height: scanAreaWidth,
    alignSelf: 'center',
    borderRadius: 6,
    overflow: 'hidden',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  cameraMask: {
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    opacity: 0.6,
    backgroundColor: 'white',
  },
  message: {
    marginTop: 48,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
  },
  photos: {
    width: 180,
    alignSelf: 'center',
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default ExternalInputHandler;
