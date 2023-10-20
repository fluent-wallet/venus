import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { useTheme, Button, Text } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import Tip from '@assets/icons/tip.svg';
import WelcomeBg from '@assets/images/welcome-bg.png';


export const AccountManageStackName = 'AccountManage'
const AccountManage: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.surfaceSecondary }} >
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
        
      </SafeAreaView>
    </View>
  );
};

export default AccountManage;
