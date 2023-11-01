import { Button, Text, useTheme } from '@rneui/themed';
import { View, SafeAreaView, TextInput } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigation, BiometricsStackName, RootStackList, AccountManageStackName } from '@router/configs';
import { useState } from 'react';
import { Mnemonic } from 'ethers';
import { validatePrivateKey } from '@core/utils/account';
import { addHexPrefix } from '@core/utils/base';
import createVaultWithRouterParams from '@pages/SetPassword/createVaultWithRouterParams';
import useInAsync from '@hooks/useInAsync';

export const ImportWalletStackName = 'ImportSeed';

const ImportWallet = () => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<StackNavigation>();
  const route = useRoute<RouteProp<RootStackList, typeof ImportWalletStackName>>();
  const { inAsync, execAsync: _createVault } = useInAsync(createVaultWithRouterParams);
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConfirmInput = async () => {
    const { type = 'create' } = route.params;

    if (value === '') return;

    if (validatePrivateKey(addHexPrefix(value))) {
      if (type === 'add') {
        await _createVault({ type: 'importPrivateKey', value });
        navigation.navigate(AccountManageStackName);
        return;
      }

      navigation.navigate(BiometricsStackName, { type: 'importPrivateKey', value });
      return;
    }
    if (Mnemonic.isValidMnemonic(value)) {
      if (type === 'add') {
        await _createVault({ type: 'importSeedPhrase', value });
        navigation.navigate(AccountManageStackName);
        return;
      }

      navigation.navigate(BiometricsStackName, { type: 'importSeedPhrase', value });
      return;
    }

    setErrorMessage('Invalid seed phrase or private key');
  };

  return (
    <SafeAreaView
      className="flex flex-1 flex-col justify-start px-[24px]"
      style={{ paddingTop: headerHeight + 16, backgroundColor: theme.colors.normalBackground }}
    >
      <View style={{ backgroundColor: theme.colors.surfacePrimary }} className="border border-blue-200 rounded-md p-1 mb-2">
        <TextInput
          underlineColorAndroid="transparent"
          editable
          multiline
          numberOfLines={10}
          placeholder="Enter your seed phrase which words separated by space or private key"
          style={{ color: theme.colors.textPrimary, justifyContent: 'flex-start' }}
          value={value}
          onChangeText={setValue}
        />
      </View>
      {errorMessage && (
        <Text style={{ color: theme.colors.warnErrorPrimary }} className="mb-5">
          {errorMessage}
        </Text>
      )}
      <Button loading={inAsync} onPress={handleConfirmInput}>
        Confirm
      </Button>
    </SafeAreaView>
  );
};

export default ImportWallet;
