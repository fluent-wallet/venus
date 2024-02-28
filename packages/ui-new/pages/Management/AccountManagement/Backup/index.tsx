import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import BottomSheet, { snapPoints } from '@components/BottomSheet';
import { BackupStackName, type StackScreenProps } from '@router/configs';
import BackupStep1 from './Step1';
import BackupStep2 from './Step2';

const Backup: React.FC<StackScreenProps<typeof BackupStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const [step, setStep] = useState(() => 1);

  return (
    <BottomSheet snapPoints={snapPoints.large} index={0} isModal={false} onClose={() => navigation.goBack()}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Back Up</Text>
        {step === 1 && <BackupStep1 setStep={setStep} />}
        {(step === 2 || step === 3) && <BackupStep2 setStep={setStep} route={route} step={step} />}
      </View>
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
