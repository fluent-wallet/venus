import ScanBorder from '@assets/icons/scan-border.svg';
import Button from '@components/Button';
import { SheetBody, SheetFooter, SheetHeader } from '@components/Sheet';
import Spinner from '@components/Spinner';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { CameraView } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import type { ParseResult } from './types';
import useQRCodeScan from './useQRCodeScan';

export type { ParseResult } from './types';

interface QrScannerProps<T> {
  title: string;
  parseInput: (raw: string, helpers: { setStatus: (status: ParseResult<T> | null) => void }) => Promise<ParseResult<T>> | ParseResult<T>;
  onConfirm?: (data: T) => void;
  externalData?: string;
  onClose: () => void;
  enableGallery?: boolean;
  enableCamera?: boolean;
  busyOverlay?: React.ReactNode;
  i18n?: {
    galleryText?: string;
    permissionTitle?: string;
    permissionDescribe?: string;
    permissionRejectTitle?: string;
    permissionRejectDescribe?: string;
    openSettingsText?: string;
    dismissText?: string;
  };
}

const scanAreaWidth = 220;

function QrScannerContent<T>({
  title,
  parseInput,
  onConfirm,
  externalData,
  onClose,
  enableGallery = true,
  enableCamera = true,
  busyOverlay,
  i18n,
}: QrScannerProps<T>) {
  const { colors, reverseColors } = useTheme();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView | null>(null);
  const isParsingRef = useRef(false);
  const isMountedRef = useRef(true);
  const permissionRequestedRef = useRef(false);
  const hasProcessedExternalDataRef = useRef(false);

  const [parseStatus, setParseStatus] = useState<ParseResult<T> | null>(null);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const updateStatus = useCallback((status: ParseResult<T> | null) => {
    if (!isMountedRef.current) return;
    setParseStatus(status);
    if (!status || status.ok || !status.blocking) {
      cameraRef.current?.resumePreview();
      isParsingRef.current = false;
    }
  }, []);

  const handleParse = useCallback(
    async (raw: string) => {
      if (isParsingRef.current) return;
      isParsingRef.current = true;
      cameraRef.current?.pausePreview();
      try {
        const result = await parseInput(raw, { setStatus: updateStatus });
        if (result.ok) {
          isParsingRef.current = false;
          onConfirm?.(result.data);
          return;
        }
        updateStatus(result);
      } catch {
        updateStatus({ ok: false, message: t('scan.QRCode.error.notRecognized') });
      }
    },
    [parseInput, onConfirm, updateStatus, t],
  );

  const onScanFailed = useCallback(() => updateStatus({ ok: false, message: t('scan.QRCode.error.notRecognized') }), [updateStatus, t]);
  const { hasCameraPermission, hasRejectCameraPermission, checkCameraPermission, pickImage, handleCodeScan } = useQRCodeScan({
    onSuccess: handleParse,
    onFailed: onScanFailed,
    isParsingRef,
  });

  useEffect(() => {
    if (externalData && !hasProcessedExternalDataRef.current) {
      hasProcessedExternalDataRef.current = true;
      handleParse(externalData);
    }
  }, [externalData, handleParse]);

  useEffect(() => {
    if (!externalData && enableCamera && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      checkCameraPermission();
    }
  }, [externalData, enableCamera, checkCameraPermission]);

  const errorStatus = parseStatus && !parseStatus.ok ? parseStatus : null;
  const isBlocking = Boolean(errorStatus?.blocking);
  const galleryText = i18n?.galleryText ?? t('scan.photos');
  const permissionTitle = i18n?.permissionTitle ?? t('scan.permission.title');
  const permissionDescribe = i18n?.permissionDescribe ?? t('scan.permission.describe');
  const permissionRejectTitle = i18n?.permissionRejectTitle ?? t('scan.permission.reject.title');
  const permissionRejectDescribe = i18n?.permissionRejectDescribe ?? t('scan.permission.reject.describe');
  const openSettingsText = i18n?.openSettingsText ?? t('scan.permission.reject.openSettings');
  const dismissText = i18n?.dismissText ?? t('common.dismiss');

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHeader title={externalData ? 'Linking' : title} />
      <SheetBody style={styles.body}>
        {!externalData && enableCamera && hasCameraPermission && (
          <>
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                facing="back"
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleCodeScan}
              />
              {isBlocking &&
                (busyOverlay ?? (
                  <>
                    <View style={styles.cameraMask} />
                    <Spinner style={{ position: 'absolute' }} width={68} height={68} color={reverseColors.iconPrimary} backgroundColor={colors.iconPrimary} />
                  </>
                ))}
            </View>
            <ScanBorder style={styles.scanBorder} color={colors.borderFourth} pointerEvents="none" />
          </>
        )}

        {(externalData || (enableCamera && hasCameraPermission)) && errorStatus?.message && (
          <Text style={[styles.message, { color: errorStatus?.type === 'connecting-wc' ? colors.up : colors.down }]}>{errorStatus.message}</Text>
        )}

        {!externalData && enableCamera && !hasCameraPermission && (
          <>
            {!hasRejectCameraPermission && (
              <>
                <Text style={[styles.tip, { color: colors.down, marginBottom: 8 }]}>{permissionTitle}</Text>
                <Text style={[styles.tip, { color: colors.textPrimary }]}>{permissionDescribe}</Text>
              </>
            )}
            {hasRejectCameraPermission && (
              <>
                <Text style={[styles.tip, { color: colors.textPrimary, marginBottom: 8 }]}>{permissionRejectTitle}</Text>
                <Text style={[styles.tip, { color: colors.textPrimary }]}>
                  <Trans i18nKey="scan.permission.reject.describe">
                    {permissionRejectDescribe} <Text style={{ color: colors.down }}>open Camera</Text>
                  </Trans>
                </Text>
              </>
            )}
          </>
        )}
      </SheetBody>

      <SheetFooter style={styles.footer}>
        {!externalData && enableGallery && enableCamera && hasCameraPermission && (
          <Button testID="photos" style={styles.photos} onPress={pickImage}>
            {galleryText}
          </Button>
        )}

        {!externalData && enableCamera && !hasCameraPermission && hasRejectCameraPermission && (
          <View style={styles.btnArea}>
            <Button testID="dismiss" style={styles.btn} onPress={onClose} size="small">
              {dismissText}
            </Button>
            <Button testID="openSettings" style={styles.btn} onPress={() => Linking.openSettings()} size="small">
              {openSettingsText}
            </Button>
          </View>
        )}

        {externalData && errorStatus && !isBlocking && (
          <View style={styles.btnArea}>
            <Button testID="dismiss" style={styles.btn} onPress={onClose} size="small">
              {dismissText}
            </Button>
          </View>
        )}
      </SheetFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
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
  footer: {
    marginTop: 'auto',
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

export default QrScannerContent;
