import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Button from '@components/Button';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right.svg';

const Welcome: React.FC<{ navigation: StackScreenProps<typeof WelcomeStackName> }> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.enterWeb3, { color: colors.textFifth }]}>Enter{'\n'}Web3</Text>

      <Button testID="Get Started" textAlign="left" Icon={ArrowRight} square />

      <View style={{ marginTop: 24, backgroundColor: 'black', padding: 32 }}>
        <Button testID="Get Started" mode="light" loading textAlign="left" onPress={() => navigation.navigate(WayToInitWalletStackName)}>
          Start
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  enterWeb3: {
    fontFamily: 'Stalinist One',
    fontSize: 40,
    lineHeight: 50,
    letterSpacing: 1,
  },
});

export default Welcome;
