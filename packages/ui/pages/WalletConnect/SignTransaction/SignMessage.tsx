import { Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Web3WalletTypes } from '@walletconnect/web3wallet';
import { isAddress, isHexString, toUtf8String } from 'ethers';
import { useCallback, useMemo } from 'react';
import { sanitizeTypedData } from './sanitizeTypedData';

interface SignMessageProps {
  payload: Web3WalletTypes.SessionRequest['params'];
}

const SignMessage: React.FC<SignMessageProps> = ({ payload }) => {
  const {
    request: { method, params },
  } = payload;

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
        console.log('could not convert to utf8', e);
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
          console.log('parse typed data error', error);
        }
      }
    }

    return m;
  }, [params, method]);

  return (
    <View>
      <View style={style.header}>
        <Text>Message</Text>
        <Pressable onPress={() => handleCopy(message)}>
          <Text>Copy</Text>
        </Pressable>
      </View>

      <Text>{message}</Text>
    </View>
  );
};

const style = StyleSheet.create({
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default SignMessage;
