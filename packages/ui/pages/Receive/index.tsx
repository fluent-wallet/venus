import { Divider, Text, useTheme } from '@rneui/themed';
import { switchMap } from 'rxjs';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import ShareIcon from '@assets/icons/share.svg';
import SetAmountIcon from '@assets/icons/setAmount.svg';
import { useState } from 'react';
import { Database, compose, withDatabase, withObservables } from '@core/DB/react';
import { Address } from '@core/DB/models/Address';
import { querySelectedAccount } from '@core/DB/models/Account/service';

import { RootStackList, SetAmountStackName } from '@router/configs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@rneui/base';

export const ReceiveStackName = 'Receive';

const Receive: React.FC<NativeStackScreenProps<RootStackList, 'Receive'> & { currentNetworkAddress: Address }> = ({ currentNetworkAddress, navigation }) => {
  const { theme } = useTheme();
  const [shareDisabled, setShareDisabled] = useState(true);
  const [setAmountDisabled, setSetAmountDisabled] = useState(false);
  const handleSetAmount = () => {
    navigation.navigate(SetAmountStackName);
  };
  return (
    <SafeAreaView
      className="flex flex-1  flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <View className="flex w-full items-center">
        <View className="w-20 h-20 rounded-full bg-slate-300"></View>
      </View>
      <Divider className="my-4" />

      <View className="flex w-full items-center">
        <QRCode value={currentNetworkAddress.hex} size={223} />
      </View>

      <View className="mt-auto">
        <View className="flex">
          <View className="flex flex-row items-center">
            <AvatarIcon width={24} height={24} />
            <Text className="ml-2 leading-6">Account 1</Text>
          </View>
          <View className="ml-8 shrink">
            <Text style={{ color: theme.colors.textSecondary }} className="leading-6">
              {currentNetworkAddress.hex}
            </Text>
          </View>
        </View>
        <Divider className="my-4" />
        <Text className="leading-6 px-9">Only send Conflux eSpace network assets to this address.</Text>

        <View className="flex flex-row justify-center mt-9">
          <View className="mr-9">
            <Button type="clear" buttonStyle={{ display: 'flex', flexDirection: 'column' }}>
              <ShareIcon width={60} height={60} color={shareDisabled ? theme.colors.surfaceSecondary : theme.colors.surfaceBrand} />
              <Text style={{ color: shareDisabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>Share</Text>
            </Button>
          </View>
          <View className="ml-9">
            <Button type="clear" buttonStyle={{ display: 'flex', flexDirection: 'column' }} onPress={handleSetAmount}>
              <SetAmountIcon width={60} height={60} color={setAmountDisabled ? theme.colors.surfaceThird : theme.colors.surfaceBrand} />
              <Text style={{ color: setAmountDisabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>Set Amount</Text>
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default compose(
  withDatabase,
  withObservables([], ({ database }: { database: Database }) => {
    const account = querySelectedAccount(database).observe();
    return {
      currentNetworkAddress: account.pipe(switchMap((account) => account[0].currentNetworkAddress)),
    };
  })
)(Receive);