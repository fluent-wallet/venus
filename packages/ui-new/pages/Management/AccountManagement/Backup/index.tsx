import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useAccountFromId, useAccountGroupFromId, useVaultOfAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import BottomSheet, { snapPoints, BottomSheetScrollView } from '@components/BottomSheet';
import { BackupStackName, type StackScreenProps } from '@router/configs';
import BackupStep1 from './Step1';
import BackupStep2 from './Step2';

const Backup: React.FC<StackScreenProps<typeof BackupStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const accountGroup = useAccountGroupFromId(route.params.groupId);
  const account = useAccountFromId(route.params.accountId);
  const vault = useVaultOfAccount(route.params.accountId);

  const [step, setStep] = useState(() => 1);

  return (
    <BottomSheet snapPoints={snapPoints.large} index={0} isModal={false} onClose={() => navigation.goBack()}>
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Back Up</Text>
        {step === 1 && <BackupStep1 setStep={setStep} />}
        {step === 2 && <BackupStep2 setStep={setStep} route={route} />}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    marginBottom: 0,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Backup;
