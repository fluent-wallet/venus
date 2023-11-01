/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { SafeAreaView, ScrollView } from 'react-native';
import { map } from 'rxjs';
import { useTheme, Text } from '@rneui/themed';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button } from '@rneui/base';
import { observeAccountById } from '@DB/models/Account/service';
import { type Account } from '@core/DB/models/Account';
import { type Address } from '@core/DB/models/Address';
import { withDatabase, withObservables, compose, type Database } from '@DB/react';
import { type StackNavigation, type RootStackList } from '@router/configs';

export const AccountSettingStackName = 'AccountSetting';

const AccountSetting: React.FC<{
  navigation: StackNavigation;
}> = compose(
  withDatabase,
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof AccountSettingStackName] } }) => {
    const account = observeAccountById(database, route.params.accountId);
    return {
      account,
      currentNetworkAddress: account.pipe(map((account) => account.currentNetworkAddress)),
    };
  })
)(({ navigation, account, currentNetworkAddress }: { navigation: StackNavigation; account: Account; currentNetworkAddress: Address }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <ScrollView className="flex-1 px-[24px]">
        <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Address
        </Text>
        <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.secondary }}>
          {currentNetworkAddress.hex}
        </Text>

        <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Account Name
        </Text>

        <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Backup
        </Text>

        <Button titleStyle={{ fontSize: 16, fontWeight: '500', color: theme.colors.surfaceBrand }} size="sm" type="clear" title="Remove Account" />
      </ScrollView>
    </SafeAreaView>
  );
});

export default AccountSetting;
