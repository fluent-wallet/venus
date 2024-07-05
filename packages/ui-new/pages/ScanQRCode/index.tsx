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
  type StackScreenProps,
} from '@router/configs';
import { type ETHURL, parseETHURL } from '@utils/ETHURL';
import { ENABLE_WALLET_CONNECT_FEATURE } from '@utils/features';
import Decimal from 'decimal.js';
import { scanFromURLAsync } from 'expo-barcode-scanner';
import { launchImageLibraryAsync } from 'expo-image-picker';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Camera, type Code, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';

// has onConfirm props means open in SendTransaction with local modal way.
interface Props {
  onConfirm?: (ethUrl: ETHURL) => void;
  navigation?: StackScreenProps<any>['navigation'];
  onClose?: () => void;
}

enum ScanStatusType {
  ConnectingWC = 'connecting-wc',
}

const scanAreaWidth = 220;
const ScanQrCode: React.FC<Props> = ({ navigation, onConfirm, onClose }) => {
  const { colors, reverseColors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork()!;

  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 30 }]);
  const [scanStatus, setScanStatus] = useState<{ type?: string; message: string }>({ message: '' });

  const isParsing = useRef(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [hasRejectPermission, setHasRejectPermission] = useState(false);

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
          setScanStatus({ message: t('scan.parse.error.missChianTypes') });
          return;
        }

        if (ethUrl.chain_id && ethUrl.parameters && ethUrl.chain_id !== currentNetwork.chainId) {
          setScanStatus({ message: t('scan.parse.error.missChianId') });
          return;
        }

        if (!(await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: ethUrl.target_address }))) {
          setScanStatus({ message: t('scan.parse.error.invalidTargetAddress') });
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
              setScanStatus({ message: 'Unvalid ETHURL.' });
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
    [onConfirm, navigation, currentNetwork],
  );

  const handleQRCode = useCallback(
    async (QRCodeString: string) => {
      isParsing.current = true;
      let ethUrl: ETHURL;
      if (await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: QRCodeString })) {
        ethUrl = { target_address: QRCodeString, schema_prefix: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum:' : 'conflux:' } as ETHURL;
        onParseEthUrlSuccess(ethUrl);
        isParsing.current = false;
        return;
      }

      try {
        if (!onConfirm && QRCodeString.startsWith('wc:') && ENABLE_WALLET_CONNECT_FEATURE.allow) {
          setScanStatus({ type: ScanStatusType.ConnectingWC, message: t('wc.connecting') });
          await plugins.WalletConnect.connect({ wcURI: QRCodeString });
        } else {
          ethUrl = parseETHURL(QRCodeString);
          onParseEthUrlSuccess(ethUrl);
          isParsing.current = false;
        }
      } catch (err) {
        isParsing.current = false;
        if (err instanceof WalletConnectPluginError) {
          if (err.message === 'VersionNotSupported') {
            setScanStatus({ message: t('scan.walletConnect.error.lowVersion') });
          } else if (err.message === 'PairingAlreadyExists') {
            setScanStatus({ message: t('scan.walletConnect.error.pairingAlreadyExists') });
          } else {
            setScanStatus({ message: `${t('scan.walletConnect.error.connectFailed')} ${String(err ?? '')}` });
          }
        } else {
          setScanStatus({ message: t('scan.QRCode.error.notRecognized') });
        }
      }
    },
    [onConfirm, onParseEthUrlSuccess, currentNetwork.networkType, t, navigation],
  );

  const handleCodeScan = useCallback(
    async (codes: Code[]) => {
      const code = codes[0];
      if (!code || isParsing.current) return;
      if (!code.value) return;

      await handleQRCode(code.value);
    },
    [handleQRCode],
  );

  const pickImage = useCallback(async () => {
    // No permissions request is necessary for launching the image library
    const result = await launchImageLibraryAsync({
      allowsEditing: true,
      allowsMultipleSelection: false,
      quality: 1,
    });
    // check is user cancel choose image
    if (!result.canceled) {
      try {
        const [assets] = result.assets;
        if (!assets || !assets.uri) return;
        // TODO: update and remove BarCodeScanner package  see : https://docs.expo.dev/versions/latest/sdk/bar-code-scanner/
        const [codeRes] = await scanFromURLAsync(assets.uri);
        if (!codeRes) {
          setScanStatus({ message: t('scan.QRCode.error.notRecognized') });
        }

        if (codeRes.data) {
          await handleQRCode(codeRes.data);
        }
      } catch (error) {
        console.log('scan image error: ', error);
      }
    }
  }, [handleQRCode]);

  const requestCameraPermission = useCallback(async () => {
    const isSuccess = await requestPermission();
    if (!isSuccess) {
      setHasRejectPermission(true);
    }
  }, []);

  const handleOnOpen = useCallback(() => {
    if (!hasPermission) {
      requestCameraPermission();
    }
  }, []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints.large}
      isRoute={!onConfirm}
      index={!onConfirm ? undefined : 0}
      onOpen={handleOnOpen}
      onClose={onClose}
    >
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('scan.title')} />
        <BottomSheetContent>
          {hasPermission && (
            <>
              {device && (
                <>
                  <View style={styles.cameraWrapper}>
                    <Camera
                      ref={camera}
                      isActive={scanStatus?.type !== ScanStatusType.ConnectingWC}
                      device={device}
                      codeScanner={{
                        codeTypes: ['qr', 'ean-13'],
                        onCodeScanned: handleCodeScan,
                      }}
                      style={styles.camera}
                      format={format}
                      enableZoomGesture
                    />
                    {scanStatus?.type === ScanStatusType.ConnectingWC && (
                      <>
                        <View style={styles.cameraMask} />
                        <Spinner
                          style={{ position: 'absolute' }}
                          width={68}
                          height={68}
                          color={reverseColors.iconPrimary}
                          backgroundColor={colors.iconPrimary}
                        />
                      </>
                    )}
                  </View>
                  <ScanBorder style={styles.scanBorder} color={colors.borderFourth} pointerEvents="none" />
                  {typeof scanStatus === 'object' && scanStatus.message && (
                    <Text style={[styles.message, { color: scanStatus?.type === ScanStatusType.ConnectingWC ? colors.up : colors.down }]}>
                      {scanStatus.message}
                    </Text>
                  )}
                </>
              )}
            </>
          )}
          {!hasPermission && (
            <>
              {!hasRejectPermission && (
                <>
                  <Text style={[styles.tip, { color: colors.down, marginBottom: 8 }]}>{t('scan.permission.title')}</Text>
                  <Text style={[styles.tip, { color: colors.textPrimary }]}>{t('scan.permission.describe')}</Text>
                </>
              )}
              {hasRejectPermission && (
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
          {hasPermission && (
            <Button testID="photos" style={styles.photos} onPress={pickImage}>
              {t('scan.photos')}
            </Button>
          )}
          {!hasPermission && hasRejectPermission && (
            <View style={styles.btnArea}>
              <Button
                testID="dismiss"
                style={styles.btn}
                onPress={() => (bottomSheetRef?.current ? bottomSheetRef.current.close() : navigation?.goBack())}
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
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default ScanQrCode;
