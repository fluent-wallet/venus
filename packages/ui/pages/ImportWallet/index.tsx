import { Button, Text, useTheme } from '@rneui/themed';
import { View, SafeAreaView, TextInput } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { createHDVault, createPrivateKeyVault } from '@core/DB/models/Vault/service';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { type RootStackList, StackNavigation, BiometricsStackName } from '@router/configs';
import { useState } from 'react';
import { Mnemonic } from 'ethers';
import { validatePrivateKey } from '@core/utils/account';
import { addHexPrefix } from '@core/utils/base';

export const ImportWalletStackName = 'ImportSeed';

const ImportWallet = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCreateHDVault = async () => {
    if (value === '') return;
    if (validatePrivateKey(addHexPrefix(value))) {
      navigation.navigate(BiometricsStackName, { type: 'importPrivateKey', value });
      return;
    }
    if (Mnemonic.isValidMnemonic(value)) {
      navigation.navigate(BiometricsStackName, { type: 'importSeedPhrase', value });
      return;
    }

    setErrorMessage('Invalid seed phrase or private key');
  };

  return (
    <SafeAreaView
      className="flex flex-1 flex-col justify-start px-[24px]"
      style={{ paddingTop: statusBarHeight + 48, backgroundColor: theme.colors.normalBackground }}
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
      <Button onPress={handleCreateHDVault}>Confirm</Button>
    </SafeAreaView>
  );
};

export default ImportWallet;
