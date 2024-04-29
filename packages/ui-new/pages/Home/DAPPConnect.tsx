import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/Text';
import { useWalletConnectSessions } from '@pages/WalletConnect/hooks';
import { useNavigation, useTheme } from '@react-navigation/native';
import Icon from '@components/Icon';
import { useTranslation } from 'react-i18next';
import take from 'lodash-es/take';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { useCallback } from 'react';
import { StackNavigation, WalletConnectSessionsStackName, WalletConnectStackName } from '@router/configs';
function DAPPConnect() {
  const { sessions } = useWalletConnectSessions();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackNavigation>();
  const handleClick = useCallback(() => {
    navigation.navigate(WalletConnectStackName, { screen: WalletConnectSessionsStackName });
  }, [navigation]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { borderColor: colors.up }]}>
      <Pressable onPress={handleClick}>
        {sessions.length === 1 ? (
          sessions.map(
            (
              {
                peer: {
                  metadata: { icons = [], url = '' },
                },
              },
              idx,
            ) => (
              <View key={idx} style={styles.content}>
                <Icon source={icons[0]} width={24} height={24} style={styles.icon} />
                <Text>{t('wc.dapp.connectTo')}</Text>
                <Text style={styles.largeText}>{url}</Text>
              </View>
            ),
          )
        ) : (
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
            <Text style={[styles.largeText, { color: colors.up }]}>{t('wc.dapp.connectedDApps')}</Text>
            <ArrowLeft style={[{ transform: [{ rotate: '-180deg' }] }]} color={colors.up} width={14} height={14} />
          </View>
        )}
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
