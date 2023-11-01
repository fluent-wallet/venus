import TableName from '@core/DB/TableName';
import { Vault } from '@core/DB/models/Vault';
import { Database } from '@core/DB/react';
import { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useTheme } from '@rneui/themed';
import { RootStackList } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { useEffect } from 'react';
import { SafeAreaView, View } from 'react-native';
import SafetyGuidelines from './Components/SafetyGuidelines';
import Secret from './Components/Secret';
import { BaseButton } from '@components/Button';

export const BackUpStackName = 'BackUp';

const BackUp: React.FC<NativeStackScreenProps<RootStackList, 'BackUp'> & { vault: Vault }> = ({ navigation, vault }) => {
  const { theme } = useTheme();
  const vaultType = vault.type;

  useEffect(() => {
    const updateHeader = async () => {
      if (vaultType === 'hierarchical_deterministic') {
        navigation.setOptions({ headerTitle: 'Select HD Wallets' });
      } else if (vaultType === 'private_key') {
        navigation.setOptions({ headerTitle: 'Backup Private Key' });
      } else {
        navigation.goBack();
      }
    };
    updateHeader();
  }, [vaultType, navigation]);

  const handleGetSecretData = async () => {
    const data = await vault.getData();
    return data;
  };
  return (
    <SafeAreaView
      className="flex flex-1  flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <Text style={{ color: theme.colors.textBrand }} className="text-4xl font-bold leading-tight text-center mb-2">
        Write Down Your {vaultType === 'hierarchical_deterministic' ? 'Seed Phrase' : 'Private Key'}
      </Text>
      <SafetyGuidelines type={vaultType} />
      <Secret type={vaultType} getSecretData={handleGetSecretData} />

      <View className="mt-auto">
        <BaseButton>
          <Text className="text-base font-medium leading-6" onPress={() => navigation.goBack()}>
            Close
          </Text>
        </BaseButton>
      </View>
    </SafeAreaView>
  );
};

export default withDatabase(
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof BackUpStackName] } }) => {
    const vault = database.collections.get<Vault>(TableName.Vault).findAndObserve(route.params.vaultId);
    return {
      vault,
    };
  })(BackUp)
);
