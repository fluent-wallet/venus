import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import BackupBottomSheet from '../SendTranscationBottomSheet';
import { SendTranscationStep2StackName, SendTranscationStep3StackName, type SendTranscationScreenProps } from '@router/configs';

const SendTranscationStep2Asset: React.FC<SendTranscationScreenProps<typeof SendTranscationStep2StackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const [assetAddress, setAssetAddress] = useState('');

  return (
    <BackupBottomSheet onClose={navigation.goBack}>
      <Text style={[styles.selectAsset, { color: colors.textSecondary }]}>Asset</Text>
      <TextInput
        containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
        showVisible={false}
        defaultHasValue={false}
        value={assetAddress}
        onChangeText={(newNickName) => setAssetAddress(newNickName?.trim())}
        isInBottomSheet
        placeholder="Enter an asset name or address"
        multiline
      />

      <Button style={styles.btn} mode="auto" onPress={() => navigation.navigate(SendTranscationStep3StackName)}>
        Next
      </Button>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  selectAsset: {
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

export default SendTranscationStep2Asset;
