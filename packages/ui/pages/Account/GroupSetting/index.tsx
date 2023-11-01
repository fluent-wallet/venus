/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useEffect } from 'react';
import { SafeAreaView, View, ScrollView } from 'react-native';
import { map } from 'rxjs';
import { useTheme, Text } from '@rneui/themed';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button } from '@rneui/base';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Vault } from '@DB/models/Vault';
import { observeAccountGroupById } from '@DB/models/AccountGroup/service';
import { withDatabase, withObservables, compose, type Database } from '@DB/react';
import { type StackNavigation, type RootStackList } from '@router/configs';

export const GroupSettingStackName = 'GroupSettingStackName';

const GroupSetting: React.FC<{
  navigation: StackNavigation;
}> = compose(
  withDatabase,
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof GroupSettingStackName] } }) => {
    const accountGroup = observeAccountGroupById(database, route.params.accountGroupId);
    return {
      accountGroup,
      vault: accountGroup.pipe(map((accountGroup) => accountGroup.vault.observe())),
    };
  })
)(({ navigation, vault, accountGroup }: { navigation: StackNavigation; accountGroup: AccountGroup; vault: Vault }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  console.log(accountGroup.nickname, vault.id);
  useEffect(() => {
    navigation.setOptions({ headerTitle: vault.type === 'hierarchical_deterministic' ? 'Seed Group' : 'BSIM Group' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <ScrollView className="flex-1 px-[24px]">
        <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Group Name
        </Text>
        <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textSecondary }}>
          {accountGroup.nickname}
        </Text>

        <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Backup
        </Text>

        <View className="mb-[8px] flex justify-between text-[16px] leading-tight">
          <Text style={{ color: theme.colors.textPrimary }}>HD Wallets</Text>

          <Button
            titleStyle={{ fontSize: 16, fontWeight: '500', color: theme.colors.surfaceBrand }}
            size="sm"
            type="clear"
            title="Manage HD Wallets"
            onPress={() => navigation.navigate('123', { type: 'add' })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

export default GroupSetting;
