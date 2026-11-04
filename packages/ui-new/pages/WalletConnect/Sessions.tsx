import Button from '@components/Button';
import Icon from '@components/Icon';
import HourglassLoading from '@components/Loading/Hourglass';
import { SheetBody, SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type { StackScreenProps, WalletConnectSessionsStackName } from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { useDisconnectWalletConnectSession, useWalletConnectSessions } from '@service/walletConnect';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

function WalletConnectSessions({ navigation }: StackScreenProps<typeof WalletConnectSessionsStackName>) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const { data: currentAddress } = useCurrentAddress();
  const currentAddressValue = currentAddress?.value ?? null;
  const sessionsQuery = useWalletConnectSessions(currentAddressValue);
  const sessions = sessionsQuery.data ?? [];
  const disconnectSession = useDisconnectWalletConnectSession();

  const [inDisconnect, setInDesconnect] = useState<Record<string, boolean>>({});
  const handleDisconnect = useCallback(
    async (topic: string) => {
      setInDesconnect((prev) => ({ ...prev, [topic]: true }));
      await disconnectSession(topic);
      setInDesconnect((prev) => ({ ...prev, [topic]: false }));
    },
    [disconnectSession],
  );

  const isUnsafe = useCallback((url: string) => {
    try {
      return new URL(url).protocol === 'http';
    } catch (error) {
      return true;
    }
  }, []);

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHeader title={t('wc.dapp.connectedDApps')} />
      <SheetBody style={styles.container}>
        <Text style={[styles.title, styles.font14, { color: colors.textSecondary }]}>{t('wc.dapp.connectTo')}</Text>
        <SheetScrollView>
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
        </SheetScrollView>
      </SheetBody>
      <SheetFooter>
        <View style={[styles.footer, { borderColor: colors.borderFourth }]}>
          <Button testID="ok" onPress={() => navigation.goBack()}>
            {t('common.ok')}
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
