import { useEffect, useCallback, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useTheme } from '@rneui/themed';
import { useAccountsOfGroup, useCurrentAddressOfAccount, useVaultOfGroup } from '@core/WalletCore/Plugins/ReactInject';
import VaultType from '@core/database/models/Vault/VaultType';
import methods from '@core/WalletCore/Methods';
import { BackUpVerifyStackName, type RootStackList } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import SafetyGuidelines from './Components/SafetyGuidelines';
import Secret from './Components/Secret';
import { useFocusEffect } from '@react-navigation/native';
import RNPreventScreenshot, { addListener } from 'react-native-screenshot-prevent';
import VaultSourceType from '@core/database/models/Vault/VaultSourceType';

const BackUp: React.FC<NativeStackScreenProps<RootStackList, 'BackUp'>> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { accountGroupId, accountIndex = 0, type } = route.params;
  const accounts = useAccountsOfGroup(accountGroupId);
  const vault = useVaultOfGroup(accountGroupId);
  const targetAccount = useMemo(() => accounts[accountIndex], [accounts, accountIndex]);
  const targetAddress = useCurrentAddressOfAccount(targetAccount?.id);
  const [isShowSecret, setIsShowSecret] = useState(false);
  const [verifySeedPhrase, setVerifySeedPhrase] = useState<{ index: number; word: string }[]>([]);
  const backupType =
    vault.type === VaultType.HierarchicalDeterministic && type === VaultType.HierarchicalDeterministic
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

  const disabledScreenShoot = useCallback(() => {
    RNPreventScreenshot.enabled(true);
    RNPreventScreenshot.enableSecureView();
    const subscription = addListener(() => {
      console.log('Screenshot taken');
    });
    return () => {
      RNPreventScreenshot.enabled(false);
      RNPreventScreenshot.disableSecureView();
      console.log('subscription: ', typeof subscription, subscription);
      (subscription as any)?.remove?.();
    };
  }, []);

  useFocusEffect(disabledScreenShoot);
  // useEffect(() => {
  //   RNPreventScreenshot.enabled(true);
  //   RNPreventScreenshot.enableSecureView();
  //   const subscription = RNPreventScreenshot.addListener(() => {
  //     console.log('Screenshot taken');
  //   });

  //   return () => {
  //     RNPreventScreenshot.enabled(false);
  //     RNPreventScreenshot.disableSecureView();
  //     subscription?.remove?.();
  //     console.log('subscription: ', tsubscription);
  //   };
  // }, []);

  const randomIndexByArray = (array: string[], length = 3) => {
    const indexes: number[] = [];
    while (indexes.length < length) {
      const index = Math.floor(Math.random() * array.length);
      if (!indexes.includes(index)) {
        indexes.push(index);
      }
    }
    return indexes;
  };

  const handleGetSecretData = useCallback(async () => {
    if (type === VaultType.HierarchicalDeterministic) {
      if (vault.type === VaultType.HierarchicalDeterministic) {
        const result = await methods.getMnemonicOfVault(vault);
        setIsShowSecret(true);
        if (vault.type === VaultType.HierarchicalDeterministic && vault.source === VaultSourceType.CREATE_BY_WALLET && vault.isBackup === false) {
          const splitArray = result.split(' ');
          const indexes = randomIndexByArray(splitArray);
          setVerifySeedPhrase(indexes.sort().map((index) => ({ index, word: splitArray[index] })));
        }

        return result;
      }
    } else if (targetAddress) {
      const result = await methods.getPrivateKeyOfAddress(targetAddress);
      setIsShowSecret(true);
      return result;
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAddress?.id]);

  useFocusEffect(useCallback(() => {
    return () => {
      setIsShowSecret(false);
      setVerifySeedPhrase([]);
    }

  }, []));

  const renderButton = () => {
    if (isShowSecret && vault.type === VaultType.HierarchicalDeterministic && vault.source === VaultSourceType.CREATE_BY_WALLET && vault.isBackup === false) {
      return (
        <BaseButton testID="next" onPress={() => navigation.navigate(BackUpVerifyStackName, { seedPhrase: verifySeedPhrase, accountGroupId: accountGroupId })}>
          <Text className="text-base font-medium leading-6" style={{ color: theme.colors.textInvert }}>
            Verify
          </Text>
        </BaseButton>
      );
    }

    return (
      <BaseButton testID="close" onPress={() => navigation.goBack()}>
        <Text className="text-base font-medium leading-6" style={{ color: theme.colors.textInvert }}>
          Close
        </Text>
      </BaseButton>
    );
  };

  if (!backupType) return;
  return (
    <SafeAreaView
      className="flex-1 flex flex-col px-[24px] pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <ScrollView className="flex-1 flex flex-col">
        <Text style={{ color: theme.colors.textBrand }} className="text-4xl font-bold leading-tight text-center mb-2">
          Write Down Your {backupType}
        </Text>
        <SafetyGuidelines backupType={backupType} />
        <Secret backupType={backupType} getSecretData={handleGetSecretData} />
      </ScrollView>
      <View>{renderButton()}</View>
    </SafeAreaView>
  );
};

export default BackUp;
