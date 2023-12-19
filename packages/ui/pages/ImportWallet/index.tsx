import { useRef, useState, useCallback } from 'react';
import { View, SafeAreaView, TextInput } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Mnemonic } from 'ethers';
import * as secp from '@noble/secp256k1';
import { Button, Text, useTheme } from '@rneui/themed';
import plugins from '@core/WalletCore/Plugins';
import methods from '@core/WalletCore/Methods';
import { stripHexPrefix } from '@core/utils/base';
import { StackNavigation, RootStackList, AccountManageStackName, BiometricsStackName, ImportWalletStackName } from '@router/configs';
import createVaultWithRouterParams from '@pages/SetPassword/createVaultWithRouterParams';
import useInAsync from '@hooks/useInAsync';

const ImportWallet = () => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<StackNavigation>();
  const route = useRoute<RouteProp<RootStackList, typeof ImportWalletStackName>>();
  const currentValue = useRef('');
  const [errorMessage, setErrorMessage] = useState('');

  const _handleConfirmInput = useCallback(async () => {
    const { type = 'create' } = route.params;
    const value = currentValue.current;

    if (value === '') return;
    if (secp.utils.isValidPrivateKey(stripHexPrefix(value))) {
      if (type === 'add') {
        const hasSame = await methods.checkHasSameVault(value);
        if (hasSame) {
          setErrorMessage('This private key has been added');
          return;
        }

        await createVaultWithRouterParams({ type: 'importPrivateKey', value: stripHexPrefix(value) });
        navigation.navigate(AccountManageStackName);
        return;
      }

      navigation.navigate(BiometricsStackName, { type: 'importPrivateKey', value });
      return;
    }
    if (Mnemonic.isValidMnemonic(value)) {
      if (type === 'add') {
        const hasSame = !(await checkNoSameVault(await plugins.CryptoTool.encrypt(value)));
        if (hasSame) {
          setErrorMessage('This seed phrase has been added');
          return;
        }
        await createVaultWithRouterParams({ type: 'importSeedPhrase', value });
        navigation.navigate(AccountManageStackName);
        return;
      }

      navigation.navigate(BiometricsStackName, { type: 'importSeedPhrase', value });
      return;
    }

    setErrorMessage('Invalid seed phrase or private key');
  }, []);

  const { inAsync, execAsync: handleConfirmInput } = useInAsync(_handleConfirmInput);

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
          onChangeText={(val) => (currentValue.current = val)}
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
