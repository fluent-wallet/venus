/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { Fragment, useEffect, useState } from 'react';
import { SafeAreaView, View, ActivityIndicator, TouchableHighlight } from 'react-native';
import { switchMap } from 'rxjs';
import { useTheme, Text, Card } from '@rneui/themed';
import { useHeaderHeight } from '@react-navigation/elements';
import { BaseButton } from '@components/Button';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Vault } from '@DB/models/Vault';
import { createAccount } from '@DB/models/Account/service';
import { type Account } from '@DB/models/Account';
import { type HdPath } from '@DB/models/HdPath';
import { querySelectedNetwork } from '@DB/models/Network/service';
import { observeAccountGroupById } from '@DB/models/AccountGroup/service';
import { shortenAddress } from '@core/utils/address';
import { withDatabase, withObservables, compose, useDatabase, type Database } from '@DB/react';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { type StackNavigation, type RootStackList } from '@router/configs';
import CheckIcon from '@assets/icons/check.svg';

export const HDManageStackName = 'HDManage';

const HDManage: React.FC<{
  navigation: StackNavigation;
}> = compose(
  withDatabase,
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof HDManageStackName] } }) => {
    const accountGroup = observeAccountGroupById(database, route.params.accountGroupId);
    const vault = accountGroup.pipe(switchMap((accountGroup) => accountGroup.vault.observe()));
    return {
      accountGroup,
      visibleAccounts: accountGroup.pipe(switchMap((accountGroup) => accountGroup.visibleAccounts.observe())),
      hideAccounts: accountGroup.pipe(switchMap((accountGroup) => accountGroup.hiddenAccounts.observe())),
      hdPath: querySelectedNetwork(database)
        .observe()
        .pipe(switchMap((network) => network?.[0].hdPath.observe())),
      mnemonic: vault.pipe(switchMap((vault) => vault.getData())),
    };
  })
)(
  ({
    navigation,
    accountGroup,
    visibleAccounts,
    hideAccounts,
    hdPath,
    mnemonic,
  }: {
    navigation: StackNavigation;
    accountGroup: AccountGroup;
    vault: Vault;
    visibleAccounts: Array<Account>;
    hideAccounts: Array<Account>;
    hdPath: HdPath;
    mnemonic: string;
  }) => {
    const { theme } = useTheme();
    const headerHeight = useHeaderHeight();
    const database = useDatabase();

    const [pageIndex, setPageIndex] = useState(0);
    const [inCalc, setInCalc] = useState(false);
    const [inNext, setInNext] = useState(false);
    const [pageAccounts, setPageAccounts] = useState<Array<{ address: string; index: number; isSelected: boolean }>>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<Array<{ address: string; index: number; isSelected: boolean }>>([]);

    useEffect(() => {
      const calcAccounts = async () => {
        setInCalc(true);
        await new Promise((resolve) => setTimeout(resolve, 10));
        const newPageAccounts = await Promise.all(
          Array.from({ length: 5 }).map((_, index) => getNthAccountOfHDKey({ mnemonic, hdPath: hdPath.value, nth: pageIndex * 5 + index }))
        );
        setPageAccounts(
          newPageAccounts.map((item) => ({
            address: item.address,
            index: item.index,
            isSelected: !!visibleAccounts.find((account) => account.index === item.index),
          }))
        );
        setInCalc(false);
      };

      calcAccounts();
    }, [pageIndex]);

    const handleClickNext = async () => {
      setInNext(true);
      const hideAccountsInSelected = hideAccounts.filter((account) => !!selectedAccounts.find((_account) => _account.index === account.index));
      const newAccountsInSelected = selectedAccounts
        .filter((account) => !hideAccountsInSelected.find((_account) => _account.index === account.index))
        .sort((a, b) => a.index - b.index);
      await database.write(async () => {
        await database.batch(...hideAccountsInSelected.map((account) => account.prepareShow()));
      });
      await Promise.all(
        newAccountsInSelected.map((account) =>
          createAccount({
            accountGroup,
            index: account.index,
          })
        )
      );
      setInNext(false);
      navigation.goBack();
    };

    return (
      <SafeAreaView
        className="flex-1 flex flex-col justify-start pb-[24px] px-[24px]"
        style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
      >
        <View className="px-[12px] py-[8px] rounded-[8px] text-[16px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
          <View className="flex flex-row justify-between items-center h-[40px]">
            <Text style={{ color: theme.colors.textPrimary }}>HD Path Type</Text>
            <Text style={{ color: theme.colors.textSecondary }}>BIP44</Text>
          </View>
          <Card.Divider className="my-[4px]" />
          <View className="flex flex-row justify-between items-center h-[40px]">
            <Text style={{ color: theme.colors.textPrimary }}>Index</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{hdPath.value}</Text>
          </View>
        </View>
        <View className="mt-[16px] relative py-[8px] min-h-[284px] rounded-[8px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
          {inCalc && (
            <View className="absolute left-0 top-0 w-full h-full bg-transparent flex justify-center items-center">
              <ActivityIndicator size={40} color={theme.colors.surfaceBrand} />
            </View>
          )}
          {pageAccounts.map((account, index) => {
            const isInSelected = selectedAccounts.find((_account) => _account === account);
            return (
              <Fragment key={account.index}>
                {index !== 0 && <View className="mx-[16px] my-[8px] w-full h-[1px]" style={{ backgroundColor: theme.colors.borderPrimary }} />}
                <TouchableHighlight
                  underlayColor={theme.colors.underlayColor}
                  disabled={account.isSelected}
                  onPress={() => {
                    if (selectedAccounts.find((_account) => _account === account)) {
                      setSelectedAccounts(selectedAccounts.filter((_account) => _account !== account));
                    } else {
                      setSelectedAccounts([...selectedAccounts, account]);
                    }
                  }}
                >
                  <View className="flex flex-row px-[16px] h-[40px] items-center">
                    <View
                      className="w-[24px] h-[24px] rounded-full border-solid border-[1px] overflow-hidden flex justify-center items-center"
                      style={{
                        backgroundColor: account.isSelected ? 'transparent' : isInSelected ? theme.colors.surfaceBrand : theme.colors.surfaceCard,
                        borderColor: account.isSelected ? 'transparent' : isInSelected ? theme.colors.surfaceCard : theme.colors.surfaceBrand,
                      }}
                    >
                      <CheckIcon
                        className="flex-shrink-0 flex-grow-0"
                        color={account.isSelected ? theme.colors.surfaceBrand : isInSelected ? theme.colors.surfaceCard : 'transparent'}
                        width={18}
                        height={16}
                      />
                    </View>
                    <Text className="ml-[4px] mr-[6px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
                      {account.index + 1}
                    </Text>
                    <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
                      {shortenAddress(account.address)}
                    </Text>
                    <Text className="ml-auto text-[16px] leading-tight" style={{ color: theme.colors.textSecondary }}>
                      {hdPath.value.slice(0, -1)}
                      {account.index}
                    </Text>
                  </View>
                </TouchableHighlight>
              </Fragment>
            );
          })}
        </View>

        <View className="mt-[16px] flex flex-row justify-between items-center">
          <BaseButton containerStyle={{ marginTop: 'auto' }} disabled={pageIndex === 0 || inNext} onPress={() => setPageIndex((pre) => pre - 1)}>
            Pre
          </BaseButton>
          <Text className="text-[16px] leading-tight" style={{ color: theme.colors.surfaceBrand }}>
            {selectedAccounts.length} address(es) selected
          </Text>
          <BaseButton containerStyle={{ marginTop: 'auto' }} onPress={() => setPageIndex((pre) => pre + 1)} disabled={inNext}>
            Next
          </BaseButton>
        </View>
        <BaseButton containerStyle={{ marginTop: 'auto' }} disabled={selectedAccounts.length === 0} onPress={handleClickNext} loading={inNext}>
          Next
        </BaseButton>
      </SafeAreaView>
    );
  }
);

export default HDManage;
