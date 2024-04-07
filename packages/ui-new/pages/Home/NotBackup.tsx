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

const NotBackup: React.FC<{ navigation: StackScreenProps<typeof HomeStackName>['navigation'] }> = ({ navigation }) => {
  const { colors } = useTheme();
  const account = useCurrentAccount();
  const vault = useVaultOfAccount(account?.id);
  const accountGroup = useGroupOfAccount(account?.id);
  useForceUpdateOnFocus(navigation);

  if (!vault || !accountGroup || vault.type !== VaultType.HierarchicalDeterministic || vault.source === VaultSourceType.IMPORT_BY_USER || vault.isBackup)
    return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.container, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={!accountGroup}
      onPress={() => navigation.navigate(BackupStackName, { screen: BackupStep1StackName, params: { groupId: accountGroup.id } })}
    >
      <View
        style={[
          styles.content,
          {
            borderColor: colors.borderPrimary,
          },
        ]}
      >
        <Image style={styles.img} source={Img} />
        <View style={styles.textArea}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Funds at risk</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            You need to back up your phrase to ensure the security of your wallet.{' '}
            <Text style={{ color: colors.textNotice, textDecorationColor: colors.textNotice, textDecorationLine: 'underline' }}>Back Up{'>'}</Text>
          </Text>
        </View>
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
    // height: 96,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  content: {
    borderWidth: 1,
    borderRadius: 8,
    paddingTop: 8,
    paddingRight: 7,
    paddingBottom: 9,
    paddingLeft: 7,
    display: 'flex',
    flexDirection: 'row',
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
