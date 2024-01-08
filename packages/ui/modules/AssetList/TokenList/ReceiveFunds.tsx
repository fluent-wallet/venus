import { View, TouchableHighlight } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { ReceiveStackName, type StackNavigation } from '@router/configs';
import QRCodeIcon from '@assets/icons/qrcode.svg';

const ReceiveFunds: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();

  return (
    <TouchableHighlight
      testID="receiveFunds"
      onPress={() => navigation.navigate(ReceiveStackName)}
      underlayColor={theme.colors.underlayColor}
      className="rounded-[8px] overflow-hidden"
    >
      <View className="flex items-center flex-row p-[16px] " style={{ backgroundColor: theme.colors.pureBlackAndWight }}>
        <View className="mr-[8px] my-[12px]">
          <QRCodeIcon color="#000" width={32} height={32} />
        </View>
        <View className="flex justify-center">
          <Text className="mb-[4px] text-[20px] font-bold leading-[24px] tracking-wider" style={{ color: theme.colors.textPrimary }}>
            Receive Funds
          </Text>
          <Text className="text-base leading-[24px] tracking-wider" style={{ color: theme.colors.textSecondary }}>
            Deposit tokens to your wallet
          </Text>
        </View>
      </View>
    </TouchableHighlight>
  );
};

export default ReceiveFunds;
