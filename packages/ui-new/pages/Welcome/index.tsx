import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Button from '@components/Button';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '@router/configs';

const Welcome: React.FC<{ navigation: StackScreenProps<typeof WelcomeStackName> }> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView>
      <Text style={{ color: colors.textPrimary }}>Enter{'\n'}Web3</Text>

      <Button testID="Get Started" loading>Start</Button>

      <View style={{ marginTop: 24, backgroundColor: 'black', padding: 32 }}>
        <Button testID="Get Started" mode="light" loading textAlign='left'>
          Start
        </Button>
      </View>
    </SafeAreaView>
  );
};
// onPress={() => navigation.navigate(WayToInitWalletStackName)}
export default Welcome;
