import { useRef, useState, useCallback } from 'react';
import { View, SafeAreaView, TextInput } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Mnemonic } from 'ethers';
import * as secp from '@noble/secp256k1';
import { Button, Text, useTheme } from '@rneui/themed';
import { trim } from 'lodash-es';
import methods from '@core/WalletCore/Methods';
import { stripHexPrefix } from '@core/utils/base';
import { StackNavigation, RootStackList, AccountManageStackName, BiometricsStackName, ImportWalletStackName } from '@router/configs';
import createVaultWithRouterParams from '@pages/SetPassword/createVaultWithRouterParams';
import useInAsync from '@hooks/useInAsync';
import useIsMountedRef from '@hooks/useIsMountedRef';

const ImportWallet = () => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<StackNavigation>();
  const route = useRoute<RouteProp<RootStackList, typeof ImportWalletStackName>>();
  const isMountedRef = useIsMountedRef();

  const currentValue = useRef('');
  const [errorMessage, setErrorMessage] = useState('');

  const _handleConfirmInput = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      const { type = 'create' } = route.params;
      const value = trim(currentValue.current ?? '');
      if (!value) {
        setErrorMessage('Input cannot be empty');
        return;
      }
      if (secp.utils.isValidPrivateKey(stripHexPrefix(value))) {
        if (type === 'add') {
          const hasSame = await methods.checkHasSameVault(value);
          if (hasSame) {
            setErrorMessage('This private key has been added');
          } else {
            if ((await createVaultWithRouterParams({ type: 'importPrivateKey', value: stripHexPrefix(value) })) && isMountedRef.current) {
              navigation.navigate(AccountManageStackName);
            }
          }
        } else {
          navigation.navigate(BiometricsStackName, { type: 'importPrivateKey', value });
        }
      } else if (Mnemonic.isValidMnemonic(value)) {
        if (type === 'add') {
          const hasSame = await methods.checkHasSameVault(value);
          if (hasSame) {
            setErrorMessage('This seed phrase has been added');
          } else {
            if ((await createVaultWithRouterParams({ type: 'importSeedPhrase', value })) && isMountedRef.current) {
              navigation.navigate(AccountManageStackName);
            }
          }
        } else {
          navigation.navigate(BiometricsStackName, { type: 'importSeedPhrase', value });
        }
      } else {
        setErrorMessage('Invalid seed phrase or private key');
      }
    } catch (_) {
      //
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  }, []);

  const { inAsync, execAsync: handleConfirmInput } = useInAsync(_handleConfirmInput);

  return (
    <SafeAreaView
      className="flex flex-1 flex-col justify-start px-[24px]"
      style={{ paddingTop: headerHeight + 16, backgroundColor: theme.colors.surfacePrimaryWithOpacity7 }}
    >
      <View style={{ backgroundColor: theme.colors.surfacePrimary }} className="border border-blue-200 rounded-md p-1 mb-2">
        <TextInput
          testID="seedPhraseInput"
          underlineColorAndroid="transparent"
          secureTextEntry={true}
          editable
          multiline
          numberOfLines={10}
          placeholder="Enter your seed phrase which words separated by space or private key"
          style={{ color: theme.colors.textPrimary, justifyContent: 'flex-start' }}
          onChangeText={(val) => {
            currentValue.current = val;
            setErrorMessage('');
          }}
        />
      </View>
      {errorMessage && (
        <Text style={{ color: theme.colors.warnErrorPrimary }} className="mb-5">
          {errorMessage}
        </Text>
      )}
      <Button testID="confirm" loading={inAsync} onPress={handleConfirmInput}>
        Confirm
      </Button>
    </SafeAreaView>
  );
};

export default ImportWallet;
