import ScanBorder from '@assets/icons/scan-border.svg';
import {
  type BottomSheetMethods,
  snapPoints,
  BottomSheetWrapper,
  BottomSheetHeader,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetRoute,
  InlineBottomSheet,
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
import { getActiveRouteName } from '@utils/backToHome';
import Decimal from 'decimal.js';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import useQRCodeScan from './useQRCodeScan';
import { CameraView } from 'expo-camera';

// has onConfirm props means open in SendTransaction with local modal way.
interface Props extends Partial<StackScreenProps<typeof ExternalInputHandlerStackName>> {
  onConfirm?: (ethUrl: ETHURL) => void;
  onClose?: () => void;
}

enum ScanStatusType {
  ConnectingWC = 'connecting-wc',
  WCTimeout = 'wc-timeout',
}

// const androidConnect =
//   'wc:8b70043955f70c3eef1c04efc854ca7c1bd42b41c42b87d7112518c683e950d5@2?expiryTimestamp=1721704750&relay-protocol=irn&symKey=6b8e12fe050eae590570b3f6f28987f4a9c6b4b18b69858085cbba3400d026c7';
// const androidSendTransaction =
//   'wc:8b70043955f70c3eef1c04efc854ca7c1bd42b41c42b87d7112518c683e950d5@2/wc?requestId=1721704596360950&sessionTopic=a518679d7b0f1441582cdb0cbbece5c575673b61b0a45f872684523140e7a963';

// const iosConnect =
//   'bimwallet://wc?uri=wc%3A3c615d3c27be4f4f5d99c7feffd1b2f9b0c00b47c35012982731b0b4dc0f0a57%402%3FexpiryTimestamp%3D1721705128%26relay-protocol%3Dirn%26symKey%3De3a235cd0bb7fe7e43f6f6fc8afb5a3dcfc3e379a74f3df66d63eac97225f9dd';
// const iosTransaction = 'bimwallet://wc?requestId=1721705752290724&sessionTopic=52a21f0eacd6c9593eb4f7b3e8dfdc881f18608204c1d443db0c9f99600bf8a0';
export const useListenDeepLink = (navigation: StackNavigation) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const url = decodeURIComponent(event.url);

        let data: string | null = null;
        if (url.startsWith('bimwallet://')) {
          if (url.startsWith('bimwallet://wc?uri=')) {
            data = url.slice(19);
          } else if (url.startsWith('bimwallet://wc?')) {
            data = url.slice(12);
          }
        } else {
          data = url;
        }
        const hasCurrentWCEvent = plugins.WalletConnect.currentEventSubject.getValue();
        if (!data || hasCurrentWCEvent) return;
        const activeRouterName = getActiveRouteName(navigation.getState());
        if (activeRouterName === ExternalInputHandlerStackName) {
          navigation.dispatch(StackActions.replace(ExternalInputHandlerStackName, { data }));
        } else {
          navigation.navigate(ExternalInputHandlerStackName, { data });
        }
      } catch (error) {
        console.log('handleDeepLinking error', error);
      }
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

  const cameraRef = useRef<CameraView | null>(null);

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
          // if no function name, then it's a native token transfer
          const nativeAsset = getAssetsTokenList()?.find((asset) => asset.type === AssetType.Native);
          if (nativeAsset && ethUrl.parameters?.value) {
            // if there has native asset and value we can go to the step 4
            navigation.dispatch(
              StackActions.replace(SendTransactionStackName, {
                screen: SendTransactionStep4StackName,
                params: {
                  recipientAddress: ethUrl.target_address,
                  asset: nativeAsset,
                  amount: new Decimal(String(ethUrl.parameters?.value)).div(Decimal.pow(10, nativeAsset.decimals ?? 18)).toString(),
                },
              }),
            );
            return;
          }
          // else go to the step 3 let user input the amount
          navigation.dispatch(
            StackActions.replace(SendTransactionStackName, {
              screen: SendTransactionStep3StackName,
              params: { recipientAddress: ethUrl.target_address, asset: nativeAsset },
            }),
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
            : allAssetsTokens?.find((asset) => asset.contractAddress?.toLowerCase() === ethUrl.parameters?.address?.toLowerCase());

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
            if (ethUrl.parameters?.uint256 || ethUrl.parameters?.value) {
              navigation.dispatch(
                StackActions.replace(SendTransactionStackName, {
                  screen: SendTransactionStep4StackName,
                  params: {
                    recipientAddress: ethUrl.target_address,
                    asset: targetAsset,
                    amount: new Decimal(String(ethUrl.parameters?.uint256 || ethUrl.parameters?.value))
                      .div(Decimal.pow(10, targetAsset.decimals ?? 18))
                      .toString(),
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
      // stop preview
      cameraRef.current?.pausePreview();
      let ethUrl: ETHURL;
      if (await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: dataString })) {
        ethUrl = { target_address: dataString, schema_prefix: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum:' : 'conflux:' } as ETHURL;
        onParseEthUrlSuccess(ethUrl);
        isParsingRef.current = false;
        return;
      }

      try {
        if (!onConfirm && (dataString.startsWith('wc:') || dataString.startsWith('wc?'))) {
          setParseStatus({ type: ScanStatusType.ConnectingWC, message: t('wc.connecting') });
          if (dataString.startsWith('wc:')) {
            await plugins.WalletConnect.connect({ wcURI: dataString });
          }

          setTimeout(() => {
            setParseStatus({ type: ScanStatusType.WCTimeout, message: '等待Wallet-Connect 响应超时' });
          }, 12888);
        } else {
          ethUrl = parseETHURL(dataString);
          onParseEthUrlSuccess(ethUrl);
          isParsingRef.current = false;
        }
      } catch (err) {
        isParsingRef.current = false;
        // error resume preview,  maybe we can delay resume preview with some time
        cameraRef.current?.resumePreview();
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
  const { hasCameraPermission, hasRejectCameraPermission, checkCameraPermission, pickImage, handleCodeScan } = useQRCodeScan({
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

  const sheetBody = (
    <BottomSheetWrapper innerPaddingHorizontal>
      <BottomSheetHeader title={externalData ? 'Linking' : t('scan.title')} />
      <BottomSheetContent>
        {!externalData && hasCameraPermission && (
          <>
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                facing="back"
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleCodeScan}
              />

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
  );

  if (onConfirm) {
    return (
      <InlineBottomSheet
        ref={bottomSheetRef}
        snapPoints={externalData ? snapPoints.percent40 : snapPoints.large}
        index={0}
        onOpen={onBottomSheetOpen}
        onClose={onClose}
      >
        {sheetBody}
      </InlineBottomSheet>
    );
  }

  return (
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={externalData ? snapPoints.percent40 : snapPoints.large} onOpen={onBottomSheetOpen}>
      {sheetBody}
    </BottomSheetRoute>
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
