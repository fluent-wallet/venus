import { Pressable, View } from 'react-native';
import { Card, Text, useTheme } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { ReceiveStackName, type StackNavigation } from '@router/configs';
import QRCodeIcon from '@assets/icons/qrcode.svg';

const ReceiveFunds: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();
  return (
    <Pressable onPress={() => navigation.navigate(ReceiveStackName)}>
      <Card>
        <View className="flex items-center flex-row">
          <View className="mr-[7px] my-[12px]">
            <QRCodeIcon color="#000" width={32} height={32} />
          </View>
          <View className="flex justify-center">
            <Text className="mb-[7px] text-[20px] font-bold leading-[25px] tracking-wider" style={{ color: theme.colors.textPrimary }}>
              Receive Funds
            </Text>
            <Text className="text-base tracking-wider" style={{ color: theme.colors.textSecondary }}>
              Deposit tokens to your wallet
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

export default ReceiveFunds;
