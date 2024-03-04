import React, { useState, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import BackupBottomSheet from './SendTranscationBottomSheet';
import { SendTranscationStep1StackName, SendTranscationStep2StackName, type SendTranscationScreenProps } from '@router/configs';
import QrCode from '@assets/icons/qr-code.svg';

const SendTranscationStep1Receiver: React.FC<SendTranscationScreenProps<typeof SendTranscationStep1StackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const [receiver, setReceiver] = useState('');

  const checkReceiver = useCallback((receiver: string) => {

  }, []);

  return (
    <BackupBottomSheet onClose={navigation.goBack}>
      <Text style={[styles.receiver, { color: colors.textSecondary }]}>Receiver</Text>
      <TextInput
        containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
        showVisible={false}
        defaultHasValue={false}
        value={receiver}
        onChangeText={(newNickName) => setReceiver(newNickName?.trim())}
        isInBottomSheet
        SuffixIcon={!receiver ? QrCode : undefined}
        showClear={!!receiver}
        placeholder="Enter an address or account name"
        multiline
      />

      <Button style={styles.btn} mode="auto" onPress={() => navigation.navigate(SendTranscationStep2StackName)}>
        Next
      </Button>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  receiver: {
    marginTop: 24,
    marginBottom: 16,
    marginLeft: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  textinput: {
    marginHorizontal: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default SendTranscationStep1Receiver;
