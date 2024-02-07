import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { useNavigation } from '@react-navigation/native';
import QRCodeIcon from '@assets/icons/qr-code.svg';

const ReceiveFunds: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  return (
    <Pressable
      testID="receiveFunds"
      style={({ pressed }) => [styles.container, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      className="rounded-[8px] overflow-hidden"
    >
      <View>
        <View className="mr-[8px] my-[12px]">
          <QRCodeIcon color="#000" width={32} height={32} />
        </View>
        <View>
          <Text>Receive Funds</Text>
          <Text>Deposit tokens to your wallet</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {},
});

export default ReceiveFunds;
