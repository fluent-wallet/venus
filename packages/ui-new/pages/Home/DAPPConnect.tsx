import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/Text';
import { useWalletConnectSessions } from '@pages/WalletConnect/hooks';
import { useNavigation, useTheme } from '@react-navigation/native';
import Icon from '@components/Icon';
import { useTranslation } from 'react-i18next';
import take from 'lodash-es/take';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { useCallback, useMemo } from 'react';
import { StackNavigation, WalletConnectSessionsStackName, WalletConnectStackName } from '@router/configs';
function DAPPConnect() {
  const { sessions } = useWalletConnectSessions();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackNavigation>();
  const handleClick = useCallback(() => {
    navigation.navigate(WalletConnectStackName, { screen: WalletConnectSessionsStackName });
  }, [navigation]);
  const hasUnsafeURL = useMemo(() => sessions.some(({ peer: { metadata } }) => new URL(metadata.url).protocol === 'http'), [sessions]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { borderColor: hasUnsafeURL ? colors.down : colors.up }]}>
      <Pressable onPress={handleClick}>
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
                  <Icon source={icons[0]} width={24} height={24} style={[styles.icon, idx > 0 ? styles.iconTranslate : {}]} />
                </View>
              ),
            )}
          </View>
          {sessions.length > 1 ? (
            <View style={styles.content}>
              <Text style={[styles.largeText, { color: hasUnsafeURL ? colors.down : colors.up }]}>{t('wc.dapp.connectedDApps')}</Text>
              <ArrowLeft style={[{ transform: [{ rotate: '-180deg' }] }]} color={hasUnsafeURL ? colors.down : colors.up} width={14} height={14} />
            </View>
          ) : (
            <View style={styles.content}>
              <Text>{t('wc.dapp.connectTo')}</Text>
              <Text style={[styles.largeText, { color: hasUnsafeURL ? colors.down : colors.up, flex: 1 }]} numberOfLines={1}>
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
  iconTranslate: {
    transform: [{ translateX: -12 }],
  },
  iconWarp: {
    display: 'flex',
    flexDirection: 'row',
  },
  largeText: {
    fontSize: 16,
  },
});

export default DAPPConnect;
