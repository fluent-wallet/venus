import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCurrentAccount, useGroupOfAccount, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import { HomeStackName, BackupStackName, type StackScreenProps } from '@router/configs';
import useForceUpdateOnFocus from '@hooks/useUpdateOnFocus';
import Img from '@assets/images/welcome-img.webp';

const NotBackup: React.FC<{ navigation: StackScreenProps<typeof HomeStackName>['navigation'] }> = ({ navigation }) => {
  const { colors } = useTheme();
  const account = useCurrentAccount();
  const vault = useVaultOfAccount(account?.id);
  const accoutGroup = useGroupOfAccount(account?.id);
  useForceUpdateOnFocus(navigation);

  if (!vault || !accoutGroup || vault.isBackup) return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.container, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={!accoutGroup}
      onPress={() => navigation.navigate(BackupStackName, { groupId: accoutGroup?.id })}
    >
      <Image style={styles.img} source={Img} />
      <View style={styles.textArea}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Funds at risk</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          You need to back up your phrase to ensure the security of your wallet. <Text>Back Up</Text>
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 96,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  img: {
    flexShrink: 0,
    alignSelf: 'center',
    width: 80,
    aspectRatio: 1.285,
    marginRight: 12,
  },
  textArea: {
    width: '100%',
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  description: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },
});

export default NotBackup;
