import { Button, Text, useTheme } from '@rneui/themed';
import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';

function CreateAccount() {
  const { theme } = useTheme();
  return (
    <View className="flex flex-1 relative" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex-1 px-[25px]">
        <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
          <Button>Private Key</Button>
        </SafeAreaView>
      </View>
    </View>
  );
}

export default CreateAccount;
