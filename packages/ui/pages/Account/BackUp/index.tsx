import { useEffect, useCallback, useMemo } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useTheme } from '@rneui/themed';
import { useAccountsOfGroup, useCurrentAddressOfAccount, useVaultOfGroup } from '@core/WalletCore/Plugins/ReactInject';
import VaultType from '@core/database/models/Vault/VaultType';
import methods from '@core/WalletCore/Methods';
import { type RootStackList } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import SafetyGuidelines from './Components/SafetyGuidelines';
import Secret from './Components/Secret';

const BackUp: React.FC<NativeStackScreenProps<RootStackList, 'BackUp'>> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { accountGroupId, accountIndex } = route.params;
  const accounts = useAccountsOfGroup(accountGroupId);
  const vault = useVaultOfGroup(accountGroupId);
  const targetAccount = useMemo(() => (accountIndex ? accounts?.[accountIndex] : undefined), [accounts, accountIndex]);
  const targetAddress = useCurrentAddressOfAccount(targetAccount?.id);

  const backupType =
    vault.type === VaultType.HierarchicalDeterministic && !targetAddress
      ? 'Seed Phrase'
      : vault.type === VaultType.PrivateKey || (vault.type === VaultType.HierarchicalDeterministic && targetAddress)
      ? 'Private Key'
      : null;

  useEffect(() => {
    if (backupType) {
      navigation.setOptions({ headerTitle: `Backup ${backupType}` });
    } else {
      navigation.goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backupType]);

  const handleGetSecretData = useCallback(async () => {
    if (!targetAddress) {
      if (vault.type === VaultType.HierarchicalDeterministic) {
        return methods.getMnemonicOfVault(vault);
      }
    } else {
      return methods.getPrivateKeyOfAddress(targetAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAddress?.id]);

  if (!backupType) return;
  return (
    <SafeAreaView
      className="flex-1 flex flex-col px-[24px] pb-[24px]"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <ScrollView className="flex-1 flex flex-col">
        <Text style={{ color: theme.colors.textBrand }} className="text-4xl font-bold leading-tight text-center mb-2">
          Write Down Your {backupType}
        </Text>
        <SafetyGuidelines backupType={backupType} />
        <Secret backupType={backupType} getSecretData={handleGetSecretData} />
      </ScrollView>
      <View>
        <BaseButton>
          <Text className="text-base font-medium leading-6" onPress={() => navigation.goBack()} style={{ color: theme.colors.textInvert }}>
            Close
          </Text>
        </BaseButton>
      </View>
    </SafeAreaView>
  );
};

export default BackUp;
