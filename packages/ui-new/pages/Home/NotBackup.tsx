import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCurrentAccount, useGroupOfAccount, useVaultOfAccount, VaultType, VaultSourceType } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import useForceUpdateOnFocus from '@hooks/useUpdateOnFocus';
import { HomeStackName, BackupStackName, BackupStep1StackName, type StackScreenProps } from '@router/configs';
// import Img from '@assets/images/welcome-img.webp';
import Img from '@assets/images/fundsAtRisk.webp';

export const useShouldShowNotBackup = () => {
  const currentAccount = useCurrentAccount();
  const vault = useVaultOfAccount(currentAccount?.id);
  const accountGroup = useGroupOfAccount(currentAccount?.id);
  return !(!vault || !accountGroup || vault.type !== VaultType.HierarchicalDeterministic || vault.source === VaultSourceType.IMPORT_BY_USER || vault.isBackup);
};

const NotBackup: React.FC<{ navigation: StackScreenProps<typeof HomeStackName>['navigation'] }> = ({ navigation }) => {
  const { colors } = useTheme();
  const shouldShowNotBackup = useShouldShowNotBackup();
  const account = useCurrentAccount();
  const accountGroup = useGroupOfAccount(account?.id);

  useForceUpdateOnFocus(navigation);

  if (!shouldShowNotBackup) return null;
  return (
    <>
      <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />
      <Pressable
        style={({ pressed }) => [styles.container, { backgroundColor: pressed ? colors.underlay : 'transparent', borderColor: colors.borderPrimary }]}
        disabled={!accountGroup}
        onPress={() => navigation.navigate(BackupStackName, { screen: BackupStep1StackName, params: { groupId: accountGroup?.id } })}
        testID="backup"
      >
        <Image style={styles.img} source={Img} />
        <View style={styles.textArea}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Funds at risk</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            You need to back up your phrase to ensure the security of your wallet.{' '}
            <Text style={{ color: colors.textNotice, textDecorationColor: colors.textNotice, textDecorationLine: 'underline' }}>Back Up{'>'}</Text>
          </Text>
        </View>
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  divider: {
    marginBottom: 16,
    height: 1,
  },
  container: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 8,
    height: 80,
    paddingHorizontal: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  img: {
    flexShrink: 0,
    alignSelf: 'center',
    width: 53,
    aspectRatio: 1.07,
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
