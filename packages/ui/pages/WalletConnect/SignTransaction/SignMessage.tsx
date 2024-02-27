import { Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Web3WalletTypes } from '@walletconnect/web3wallet';
import { isAddress, isHexString, toUtf8String } from 'ethers';
import { useCallback, useMemo } from 'react';
import { sanitizeTypedData } from './sanitizeTypedData';
import { BaseButton } from '@components/Button';
import { useCurrentAccount, useCurrentAddress, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import useProvider from '@hooks/useProvider';
import VaultType from '@core/database/models/Vault/VaultType';
import Methods from '@core/WalletCore/Methods';
import { useNavigation } from '@react-navigation/native';
import BSIM from '@WalletCoreExtends/Plugins/BSIM';

interface SignMessageProps {
  payload: Web3WalletTypes.SessionRequest['params'];
  onSignMessage: (message: string) => void;
  onCancel: () => void;
}

const SignMessage: React.FC<SignMessageProps> = ({ payload, onSignMessage, onCancel }) => {
  const {
    request: { method, params },
  } = payload;

  const currentAccount = useCurrentAccount()!;
  const vault = useVaultOfAccount(currentAccount?.id);
  const provider = useProvider();
  const currentAddress = useCurrentAddress()!;

  console.log('payload', JSON.stringify(payload));

  const handleCopy = useCallback((message: string) => {
    Clipboard.setString(message);
  }, []);
  const message = useMemo(() => {
    let m = params?.find((p: any) => !isAddress(p));
    if (method === 'personal_sign') {
      try {
        if (isHexString(m)) {
          m = toUtf8String(m);
        }
      } catch (e) {
        return '';
      }
    }
    if (method.startsWith('eth_signTypedData')) {
      if (Array.isArray(params) && params[0]) {
        let data = params[0] ?? null;

        if (isAddress(params[0])) {
          data = params[1] ?? null;
        }

        try {
          const parsedMessage = JSON.parse(data);
          const sanitizedMessage = sanitizeTypedData(parsedMessage);
          m = JSON.stringify(sanitizedMessage, null, 4);
        } catch (error) {
          return '';
        }
      }
    }
    return m;
  }, [params, method]);

  const handleSignMessage = useCallback(async () => {
    if (!message) return;

    const vaultType = vault.type;

    if (method === 'personal_sign') {
      try {
        if (vaultType === VaultType.BSIM) {
          const hex = await BSIM.signMessage(message, currentAddress?.hex);
          onSignMessage(hex);
        } else {
          const pk = await Methods.getPrivateKeyOfVault(vault);
          const signer = await provider.getSigner(pk);
          const hex = await signer.signMessage(message);
          onSignMessage(hex);
        }
      } catch (error) {
        console.log('personal_sign error', error);
      }
    } else if (method.startsWith('eth_signTypedData')) {
      try {
        const m = JSON.parse(message);

        if (vaultType === VaultType.BSIM) {
          const hex = await BSIM.signTypedData(m.domain, m.types, m.message, currentAddress?.hex);
          onSignMessage(hex);
        } else {
          const pk = await Methods.getPrivateKeyOfVault(vault);
          const signer = await provider.getSigner(pk);
          const hex = await signer.signTypedData(m.domain, m.types, m.message);
          onSignMessage(hex);
        }
      } catch (error) {
        console.log('eth_signTypedData error', error);
      }
    }
  }, [message, onSignMessage, provider, vault, currentAddress.hex, method]);

  return (
    <View>
      <View style={style.header}>
        <Text>Message</Text>
        <Pressable onPress={() => handleCopy(message)}>
          <Text>Copy</Text>
        </Pressable>
      </View>

      <View>
        <Text>{message || "message is empty or can't decode"}</Text>
      </View>

      <View style={style.buttons}>
        <BaseButton containerStyle={{ flex: 1 }} onPress={onCancel}>
          Cancel
        </BaseButton>
        <BaseButton containerStyle={{ flex: 1 }} disabled={!message} onPress={handleSignMessage}>
          Confirm
        </BaseButton>
      </View>
    </View>
  );
};

const style = StyleSheet.create({
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'row',
  },
});

export default SignMessage;
