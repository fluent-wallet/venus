import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useTheme } from '@react-navigation/native';
import take from 'lodash-es/take';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import Icon from '@components/Icon';
import Text from '@components/Text';
import { useWalletConnectSessions } from '@pages/WalletConnect/useWalletConnectHooks';
import { StackNavigation, WalletConnectSessionsStackName, WalletConnectStackName } from '@router/configs';
import ArrowLeft from '@assets/icons/arrow-left.svg';

function DAPPConnect() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackNavigation>();
  const currentAddressValue = useCurrentAddressValue();
  const { sessions } = useWalletConnectSessions(currentAddressValue);
  const hasUnsafeURL = useMemo(() => sessions.some(({ peer: { metadata } }) => new URL(metadata.url).protocol === 'http'), [sessions]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { borderColor: hasUnsafeURL ? colors.down : colors.up }]}>
      <Pressable onPress={() => navigation.navigate(WalletConnectStackName, { screen: WalletConnectSessionsStackName })}>
        <View style={styles.content}>
          <View style={styles.iconWarp}>
            {take(sessions, 3).map(
              (
                {
                  peer: {
                    metadata: { icons = [] },
                  },
                },
                idx,
              ) => (
                <View key={idx}>
                  <Icon source={icons[0]} width={24} height={24} style={[styles.icon, idx > 0 ? { transform: [{ translateX: -10 * idx }] } : {}]} />
                </View>
              ),
            )}
          </View>
          {sessions.length > 1 ? (
            <View style={styles.content}>
              <Text
                style={[
                  styles.largeText,
                  { color: hasUnsafeURL ? colors.down : colors.up },
                  { transform: [{ translateX: -10 * Math.min(sessions.length - 1, 3) }] },
                ]}
              >
                {t('wc.dapp.connectedDApps')}
              </Text>
              <ArrowLeft
                style={[{ transform: [{ translateX: -10 * Math.min(sessions.length - 1, 3) }, { rotate: '-180deg' }] }]}
                color={hasUnsafeURL ? colors.down : colors.up}
                width={14}
                height={14}
              />
            </View>
          ) : (
            <View style={[styles.content, { paddingRight: 12 }]}>
              <Text style={{ color: colors.textPrimary }}>{t('wc.dapp.connectTo')}</Text>
              <Text style={[styles.largeText, { color: hasUnsafeURL ? colors.down : colors.up, flex: 1, flexGrow: 1 }]} numberOfLines={1}>
                {sessions[0]?.peer?.metadata?.url}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  content: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    borderRadius: 12,
  },

  iconWarp: {
    display: 'flex',
    flexDirection: 'row',
  },
  largeText: {
    fontSize: 16,
    fontWeight: '300'
  },
});

export default DAPPConnect;
