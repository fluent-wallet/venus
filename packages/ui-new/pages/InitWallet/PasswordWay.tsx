import React from 'react';
import { ImageBackground, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, StackActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '@router/configs';
import Img from '@assets/images/welcome-img.webp';

const PasswordWay: React.FC<{ navigation: StackScreenProps<typeof WelcomeStackName> }> = ({ navigation }) => {
  const { mode, colors } = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.first, { color: colors.textFifth, backgroundColor: colors.bgThird }]}>Password Way</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 48,
  },
  enterWeb3: {
    width: 232,
    height: 100,
  },
  first: {
    marginTop: 24,
    fontFamily: 'Stalinist One',
    width: 230,
    height: 24,
    lineHeight: 24,
    fontSize: 10,
    textAlign: 'center',
  },
  img: {
    width: 388,
    height: 388,
    marginTop: 24,
  },
  btn: {
    width: 360,
    marginTop: 44,
  },
});

export default PasswordWay;
