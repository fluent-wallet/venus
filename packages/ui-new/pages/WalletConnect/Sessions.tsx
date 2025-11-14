import {
  snapPoints,
  BottomSheetWrapper,
  BottomSheetScrollContent,
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetRoute,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import Text from '@components/Text';
import HourglassLoading from '@components/Loading/Hourglass';
import Plugins from '@core/WalletCore/Plugins';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { useTheme } from '@react-navigation/native';
import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useWalletConnectSessions } from './useWalletConnectHooks';

function WalletConnectSessions() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const currentAddressValue = useCurrentAddressValue();
  const sessions = useWalletConnectSessions(currentAddressValue);

  const [inDisconnect, setInDesconnect] = useState<Record<string, boolean>>({});
  const handleDisconnect = useCallback(async (topic: string) => {
    setInDesconnect((prev) => ({ ...prev, [topic]: true }));
    await Plugins.WalletConnect.disconnectSession({ topic });
    setInDesconnect((prev) => ({ ...prev, [topic]: false }));
  }, []);

  const isUnsafe = useCallback((url: string) => {
    try {
      return new URL(url).protocol === 'http';
    } catch (error) {
      return true;
    }
  }, []);

  return (
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={snapPoints.percent55}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('wc.dapp.connectedDApps')}>
          <Text style={[styles.title, styles.font14, { color: colors.textSecondary }]}>{t('wc.dapp.connectTo')}</Text>
        </BottomSheetHeader>
        <BottomSheetScrollContent>
          {sessions?.map(
            ({
              peer: {
                metadata: { url = '', icons = [] },
              },
              topic,
            }) => (
              <View key={topic} style={styles.connect}>
                <View style={styles.connectLeft}>
                  <Icon rounded source={icons[0]} width={24} height={24} />
                  <Text style={[styles.font16, { color: isUnsafe(url) ? colors.down : colors.up, flex: 1 }]} numberOfLines={1}>
                    {url}
                  </Text>
                </View>
                {inDisconnect[topic] && <HourglassLoading style={styles.inDisconnectLoading} />}
                {!inDisconnect[topic] && (
                  <Pressable testID="disconnect" onPress={() => handleDisconnect(topic)} disabled={inDisconnect[topic]}>
                    <Text style={[styles.font14, { color: isUnsafe(url) ? colors.down : colors.textPrimary }]}>{t('common.disconnect')}</Text>
                  </Pressable>
                )}
              </View>
            ),
          )}
        </BottomSheetScrollContent>

        <BottomSheetFooter style={[styles.footer, { borderColor: colors.borderFourth }]}>
          <Button testID="ok" onPress={() => bottomSheetRef.current?.close()}>
            {t('common.ok')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 40,
  },
  font14: {
    fontSize: 14,
    fontWeight: '300',
  },
  font16: {
    fontSize: 16,
    fontWeight: '300',
  },
  inDisconnectLoading: {
    width: 20,
    height: 20,
  },
  connect: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 24,
  },
});

export default WalletConnectSessions;
