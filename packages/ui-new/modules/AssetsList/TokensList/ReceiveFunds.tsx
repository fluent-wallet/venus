import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Button from '@components/Button';
import Text from '@components/Text';
import { HomeStackName, ReceiveStackName, type StackScreenProps } from '@router/configs';
// import Img from '@assets/images/welcome-img.webp';
import Img from '@assets/images/home-receive.webp'

const ReceiveFunds: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();

  return (
    <>
      <Image style={styles.img} source={Img} contentFit="contain" />
      <Text style={[styles.text, { color: colors.textSecondary }]}>Deposit tokens to your wallet</Text>
      <Button testID="receiveFunds" style={styles.btn} onPress={() => navigation.navigate(ReceiveStackName)}>
        Receive
      </Button>
    </>
  );
};

const styles = StyleSheet.create({
  img: {
    alignSelf: 'center',
    width: 160,
    aspectRatio: 1,
    marginTop: 36,
  },
  text: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btn: {
    alignSelf: 'center',
    width: 184,
  },
});

export default ReceiveFunds;
