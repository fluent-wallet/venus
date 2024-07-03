import ArrowRight from '@assets/icons/arrow-right2.svg';
import Icon from '@components/Icon';
import Text from '@components/Text';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { useWalletConnectSessions } from '@pages/WalletConnect/useWalletConnectHooks';
import { useNavigation, useTheme } from '@react-navigation/native';
import { type StackNavigation, WalletConnectSessionsStackName, WalletConnectStackName } from '@router/configs';
import take from 'lodash-es/take';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

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
          <View style={[styles.iconWarp, { width: 14 * Math.min(sessions.length - 1, 3) + 24 }]}>
            {take(sessions, 3).map(
              (
                {
                  topic,
                  peer: {
                    metadata: { icons = [] },
                  },
                },
                idx,
              ) => (
                <View key={topic}>
                  <Icon source={icons[0]} width={24} height={24} style={[styles.icon, idx > 0 ? { transform: [{ translateX: -10 * idx }] } : {}]} />
                </View>
              ),
            )}
          </View>
          {sessions.length > 1 ? (
            <View style={styles.content}>
              <Text style={[styles.largeText, { color: hasUnsafeURL ? colors.down : colors.up }]}>{t('wc.dapp.connectedDApps')}</Text>
              <ArrowRight color={hasUnsafeURL ? colors.down : colors.up} width={14} height={14} />
            </View>
          ) : (
            <View style={[styles.content, { paddingRight: 24 }]}>
              <Text style={{ color: colors.textPrimary }}>{t('wc.dapp.connectTo')}</Text>

              <Text style={[styles.largeText, { color: hasUnsafeURL ? colors.down : colors.up, flex: 1, flexGrow: 1 }]} numberOfLines={1}>
                {sessions[0]?.peer?.metadata?.url}
              </Text>
              <ArrowRight color={hasUnsafeURL ? colors.down : colors.up} width={14} height={14} />
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
    fontWeight: '300',
    lineHeight: 18
  },
});

export default DAPPConnect;
