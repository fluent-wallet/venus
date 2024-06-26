import BottomSheet, { snapPoints, BottomSheetScrollView, BottomSheetView } from '@components/BottomSheet';
import Text from '@components/Text';
import { useTranslation } from 'react-i18next';
import { useWalletConnectSessions } from './useWalletConnectHooks';
import { Pressable, StyleSheet, View } from 'react-native';
import Button from '@components/Button';
import Icon from '@components/Icon';
import { useNavigation, useTheme } from '@react-navigation/native';
import Plugins from '@core/WalletCore/Plugins';
import { useCallback } from 'react';
import useInAsync from '@hooks/useInAsync';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
function WalletConnectSessions() {
  const { t } = useTranslation();
  const currentAddressValue = useCurrentAddressValue();
  const { sessions } = useWalletConnectSessions(currentAddressValue);
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
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wc.dapp.connectedDApps')}</Text>

      <View style={[styles.list, { borderBottomColor: colors.borderFourth }]}>
        <Text style={[styles.font14, { color: colors.textSecondary }]}>{t('wc.dapp.connectTo')}</Text>
        <BottomSheetView style={[{ height: 160, overflow: 'hidden' }]}>
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
                    <Text style={[styles.font16, { color: isUnsafe(url) ? colors.down : colors.up, flex: 1 }]} numberOfLines={1}>
                      {url}
                    </Text>
                  </View>
                  <Pressable testID="disconnect" onPress={() => handleDisconnect(topic)} disabled={inAsync}>
                    <Text style={[styles.font14, { color: isUnsafe(url) ? colors.down : colors.textPrimary }]}>{t('common.disconnect')}</Text>
                  </Pressable>
                </View>
              ),
            )}
          </BottomSheetScrollView>
        </BottomSheetView>
      </View>
      <Button testID="ok" onPress={() => navigation.goBack()} style={styles.btn}>
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
  container: {},
  list: {
    marginTop: 40,
    flex: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  font14: {
    fontSize: 14,
    fontWeight: '300',
  },
  font16: {
    fontSize: 16,
    fontWeight: '300',
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
  btn: {
    marginTop: 24,
    marginBottom: 78,
    marginHorizontal: 16,
  },
});

export default WalletConnectSessions;
