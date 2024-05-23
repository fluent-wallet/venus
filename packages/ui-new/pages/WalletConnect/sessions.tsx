import BottomSheet, { snapPoints, BottomSheetScrollView } from '@components/BottomSheet';
import Text from '@components/Text';
import { useTranslation } from 'react-i18next';
import { useWalletConnectSessions } from './useListenWalletConnectEvent';
import { Pressable, StyleSheet, View } from 'react-native';
import Button from '@components/Button';
import Icon from '@components/Icon';
import { useNavigation, useTheme } from '@react-navigation/native';
import Plugins from '@core/WalletCore/Plugins';
import { useCallback } from 'react';
import useInAsync from '@hooks/useInAsync';
function WalletConnectSessions() {
  const { t } = useTranslation();
  const { sessions } = useWalletConnectSessions();
  const navigation = useNavigation();
  const { colors } = useTheme();
  // TODO: maybe add confirm
  const _handleDisconnect = useCallback(async (topic: string) => {
    await Plugins.WalletConnect.disconnectSession({ topic });
  }, []);
  const { inAsync, execAsync: handleDisconnect } = useInAsync(_handleDisconnect);

  const isUnsafe = useCallback((url: string) => new URL(url).protocol === 'http', []);

  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent50} style={styles.container}>
      <Text style={styles.title}>{t('wc.dapp.connectedDApps')}</Text>

      <View style={styles.list}>
        <Text>{t('wc.dapp.connectTo')}</Text>
        <BottomSheetScrollView>
          {sessions.map(
            (
              {
                peer: {
                  metadata: { url = '', icons = [] },
                },
                topic,
              },
              idx,
            ) => (
              <View key={idx} style={styles.connect}>
                <View style={styles.connectLeft}>
                  <Icon rounded source={icons[0]} width={24} height={24} />
                  <Text style={{ color: isUnsafe(url) ? colors.down : colors.up, flex: 1 }} numberOfLines={1}>
                    {url}
                  </Text>
                </View>
                <Pressable testID="disconnect" onPress={() => handleDisconnect(topic)} disabled={inAsync}>
                  <Text style={{ color: isUnsafe(url) ? colors.down : colors.textPrimary }}>{t('common.disconnect')}</Text>
                </Pressable>
              </View>
            ),
          )}
        </BottomSheetScrollView>
      </View>
      <Button testID="ok" onPress={() => navigation.goBack()}>
        {t('common.ok')}
      </Button>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    paddingHorizontal: 16,
  },
  list: {
    marginVertical: 40,
    flex: 1,
  },
  connect: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

export default WalletConnectSessions;
