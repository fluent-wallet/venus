import React from 'react';
import { Text, Button } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '../../router/configs';

const Welcome: React.FC<{ navigation: StackScreenProps<typeof WelcomeStackName> }> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView>
      <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: colors.textPrimary }}>
        Enter{'\n'}Web3
      </Text>
      <Text className="mt-[8px] text-[16px] leading-[24px] text-center">First, let's add a wallet</Text>

      <Button testID="Get Started" onPress={() => navigation.navigate(WayToInitWalletStackName)} title="Start"></Button>
    </SafeAreaView>
  );
};

export default Welcome;
