import { useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView } from 'react-native';

export const SetAmountStackName = 'SetAmount';

const SetAmount = () => {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      className="flex flex-1  flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    ></SafeAreaView>
  );
};

export default SetAmount;
