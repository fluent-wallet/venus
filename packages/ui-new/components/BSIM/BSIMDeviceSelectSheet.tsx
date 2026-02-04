import { BottomSheetContent, BottomSheetHeader, type BottomSheetMethods, BottomSheetWrapper, InlineBottomSheet, snapPoints } from '@components/BottomSheet';
import Spinner from '@components/Spinner';
import Text from '@components/Text';
import plugins from '@core/WalletCore/Plugins';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type DeviceItem = { deviceId: string; name: string };

interface Props {
  bottomSheetRef: React.RefObject<BottomSheetMethods>;
  onConnect: () => Promise<void>;
  onScanError: (error: unknown) => void;
  onOpenChange?: (open: boolean) => void;
}

const formatDeviceSuffix = (deviceId: string) => {
  const compact = String(deviceId ?? '');
  if (!compact) return '';
  return compact.length > 6 ? compact.slice(-6) : compact;
};

const upsertDevice = (prev: DeviceItem[], next: DeviceItem) => {
  const index = prev.findIndex((item) => item.deviceId === next.deviceId);
  if (index < 0) return [...prev, next];
  const copy = prev.slice();
  copy[index] = next;
  return copy;
};

const BSIMDeviceSelectSheet: React.FC<Props> = ({ bottomSheetRef, onConnect, onScanError, onOpenChange }) => {
  const { colors, palette, reverseColors, mode } = useTheme();

  const scanHandleRef = useRef<{ stop(): void } | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const { t } = useTranslation();

  const stopScan = useCallback(() => {
    scanHandleRef.current?.stop();
    scanHandleRef.current = null;
  }, []);

  const startScan = useCallback(() => {
    stopScan();
    setDevices([]);

    scanHandleRef.current = plugins.BSIM.startNearbyBSIMDeviceScan(
      (device) => {
        setDevices((prev) => upsertDevice(prev, device));
      },
      (error) => {
        stopScan();
        bottomSheetRef.current?.close();
        onScanError(error);
      },
    );
  }, [bottomSheetRef, onScanError, stopScan]);

  const handleSheetChange = useCallback(
    (index: number) => {
      onOpenChange?.(index !== -1);

      if (index === -1) {
        stopScan();
        setDevices([]);
        setConnectingDeviceId(null);
        return;
      }
      startScan();
    },
    [onOpenChange, startScan, stopScan],
  );

  const handleConnectDevice = useCallback(
    async (deviceId: string) => {
      if (connectingDeviceId) return;

      setConnectingDeviceId(deviceId);
      stopScan();

      plugins.BSIM.setBleDeviceId(deviceId);

      try {
        await onConnect();
      } finally {
        setConnectingDeviceId(null);
        bottomSheetRef.current?.close();
      }
    },
    [bottomSheetRef, connectingDeviceId, onConnect, stopScan],
  );

  return (
    <InlineBottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints.percent45}
      index={-1}
      onChange={handleSheetChange}
      enablePanDownToClose={!connectingDeviceId}
      enableContentPanningGesture={!connectingDeviceId}
      enableHandlePanningGesture={!connectingDeviceId}
      backDropPressBehavior={connectingDeviceId ? 'none' : 'close'}
    >
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={`${t('common.scanning')}...`} />
        <BottomSheetContent>
          {devices.map((device) => {
            const suffix = formatDeviceSuffix(device.deviceId);
            const isConnecting = connectingDeviceId === device.deviceId;

            return (
              <View key={device.deviceId} style={[styles.row, { borderColor: colors.borderFourth }]}>
                <View style={styles.rowLeft}>
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {device.name}
                  </Text>
                  <Text style={[styles.suffix, { color: colors.textSecondary }]} numberOfLines={1}>
                    {suffix ? `(…${suffix})` : ''}
                  </Text>
                </View>

                <Pressable disabled={!!connectingDeviceId} onPress={() => handleConnectDevice(device.deviceId)} hitSlop={8}>
                  {isConnecting ? (
                    <Spinner width={18} height={18} color={reverseColors[mode === 'light' ? 'iconPrimary' : 'textSecondary']} backgroundColor={palette.gray4} />
                  ) : (
                    <Text style={[styles.connect, { color: colors.up }]}>{t('common.connect')}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </BottomSheetContent>
      </BottomSheetWrapper>
    </InlineBottomSheet>
  );
};

const styles = StyleSheet.create({
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '400',
    maxWidth: '75%',
  },
  suffix: {
    marginLeft: 8,
    fontSize: 12,
  },
  connect: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default BSIMDeviceSelectSheet;
