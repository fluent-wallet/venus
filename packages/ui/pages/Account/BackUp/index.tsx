import { useEffect, useCallback } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { switchMap, map } from 'rxjs';
import { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useTheme } from '@rneui/themed';
import { type RootStackList } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import TableName from '@core/DB/TableName';
import { type Vault } from '@core/DB/models/Vault';
import { type Address } from '@core/DB/models/Address';
import { type Database } from '@core/DB/react';
import SafetyGuidelines from './Components/SafetyGuidelines';
import Secret from './Components/Secret';
import { BaseButton } from '@components/Button';

export const BackUpStackName = 'BackUp';

const BackUp: React.FC<NativeStackScreenProps<RootStackList, 'BackUp'> & { vault: Vault; address?: Address }> = ({ navigation, vault, address }) => {
  const { theme } = useTheme();

  const backupType =
    vault.type === 'hierarchical_deterministic' && !address
      ? 'Seed Phrase'
      : vault.type === 'private_key' || (vault.type === 'hierarchical_deterministic' && address)
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
    if ((vault.type === 'hierarchical_deterministic' && !address) || vault.type === 'private_key') {
      return vault.getData();
    } else {
      return address?.getPrivateKey?.() ?? '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.type, address]);

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

        <View className="mt-auto">
          <BaseButton>
            <Text className="text-base font-medium leading-6" onPress={() => navigation.goBack()}>
              Close
            </Text>
          </BaseButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default withDatabase(
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof BackUpStackName] } }) => {
    const vault = database.collections.get<Vault>(TableName.Vault).findAndObserve(route.params.vaultId);
    if (typeof route.params.accountIndex === 'number') {
      return {
        vault,
        address: vault.pipe(
          switchMap((vault) => vault.accountGroup.observe()),
          map((accountGroup) => accountGroup?.[0]),
          switchMap((accountGroup) => accountGroup.getAccountByIndex(route.params.accountIndex!)),
          switchMap((account) => account.currentNetworkAddress)
        ),
      };
    } else {
      return {
        vault,
      };
    }
  })(BackUp)
);
