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
import { createNewBSIMAccount, createBSIMAccountToIndex, getBIMList } from '@core/BSIMSDK/service';
import { shortenAddress } from '@core/utils/address';
import { withDatabase, withObservables, compose, useDatabase, type Database } from '@DB/react';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { type StackNavigation, type RootStackList } from '@router/configs';
import CheckIcon from '@assets/icons/check.svg';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { colors } from 'packages/ui/theme';

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
      accounts: accountGroup.pipe(switchMap((accountGroup) => accountGroup.account.observe())),
      visibleAccounts: accountGroup.pipe(switchMap((accountGroup) => accountGroup.visibleAccounts.observe())),
      selectedAccount: accountGroup.pipe(switchMap((accountGroup) => accountGroup.selectedAccount)),
      hdPath: querySelectedNetwork(database)
        .observe()
        .pipe(switchMap((network) => network?.[0].hdPath.observe())),
      vault,
      mnemonic: vault.pipe(switchMap((vault) => vault.getData())),
    };
  })
)(
  ({
    navigation,
    accountGroup,
    visibleAccounts,
    accounts,
    selectedAccount,
    hdPath,
    mnemonic,
    vault,
  }: {
    navigation: StackNavigation;
    accountGroup: AccountGroup;
    vault: Vault;
    visibleAccounts: Array<Account>;
    accounts: Array<Account>;
    selectedAccount: Account | null;
    hdPath: HdPath;
    mnemonic: string;
  }) => {
    const { theme } = useTheme();
    const headerHeight = useHeaderHeight();
    const database = useDatabase();

    const [pageIndex, setPageIndex] = useState(0);
    const [inCalc, setInCalc] = useState(false);
    const [inNext, setInNext] = useState(false);
    const [pageAccounts, setPageAccounts] = useState<Array<{ hexAddress: string; index: number }>>([]);
    const [chooseAccounts, setChooseAccounts] = useState<Array<{ index: number }>>([]);
    useEffect(() => {
      const initChooseAccounts = async () => {
        setChooseAccounts(
          (await Promise.all(visibleAccounts.map(async (account) => ({ index: account.index, hexAddress: (await account.address)?.[0]?.hex })))) ?? []
        );
      };

      initChooseAccounts();
    }, []);

    useEffect(() => {
      const calcAccounts = async () => {
        setInCalc(true);
        await new Promise((resolve) => setTimeout(resolve, 10));

        let accountsList: Awaited<ReturnType<typeof getBIMList>> = [];
        if (vault.type === 'BSIM') {
          await createBSIMAccountToIndex((pageIndex + 1) * 5);
          accountsList = await getBIMList();
        }

        const newPageAccounts = await Promise.all(
          Array.from({ length: 5 }).map(async (_, index) => {
            const targetAlreadyInAccounts = accounts?.find((account) => account.index === pageIndex * 5 + index);
            if (targetAlreadyInAccounts) return { hexAddress: (await targetAlreadyInAccounts.address)?.[0]?.hex, index: targetAlreadyInAccounts.index };
            if (vault.type === 'BSIM') {
              const targetAlreadyInList = accountsList?.find((account) => account.index === pageIndex * 5 + index);
              if (targetAlreadyInList) return { hexAddress: targetAlreadyInList.hexAddress, index: targetAlreadyInList.index };

              // The code shouldn't have been able to get here.
              const { hexAddress, index: newIndex } = await createNewBSIMAccount();
              if (newIndex === pageIndex * 5 + index) {
                return { hexAddress, index: newIndex };
              }
              throw new Error('????');
            } else {
              return getNthAccountOfHDKey({ mnemonic, hdPath: hdPath.value, nth: pageIndex * 5 + index });
            }
          })
        );
        setPageAccounts(
          newPageAccounts.map((item) => ({
            hexAddress: item.hexAddress,
            index: item.index,
          }))
        );
        setInCalc(false);
      };

      calcAccounts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex]);

    const handleClickNext = async () => {
      setInNext(true);
      const newAccountsInChoose = chooseAccounts
        .filter((account) => !accounts.find((_account) => _account.index === account.index))
        .sort((a, b) => a.index - b.index);
      const oldAccountsNeedHidden = accounts.filter((account) => !chooseAccounts.find((_account) => _account.index === account.index));
      const oldAccountsNeedShow = accounts.filter((account) => !!chooseAccounts.find((_account) => _account.index === account.index));
      await database.write(async () => {
        await database.batch(...oldAccountsNeedHidden.map((account) => account.prepareHide()), ...oldAccountsNeedShow.map((account) => account.prepareShow()));
      });

      newAccountsInChoose.forEach(async (account) => {
        try {
          await createAccount({
            accountGroup,
            ...account,
          });
        } catch (err) {
          console.error(err);
        }
      });

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
            const isSelected = !!selectedAccount && selectedAccount.index === account.index;
            const isInChoose = !!chooseAccounts?.find((_account) => _account.index === account.index);
            return (
              <Fragment key={account.index}>
                {index !== 0 && <View className="mx-[16px] my-[8px] w-full h-[1px]" style={{ backgroundColor: theme.colors.borderPrimary }} />}
                <TouchableHighlight
                  underlayColor={theme.colors.underlayColor}
                  disabled={isSelected}
                  onPress={() => {
                    if (chooseAccounts.find((_account) => _account.index === account.index)) {
                      setChooseAccounts(chooseAccounts.filter((_account) => _account.index !== account.index));
                    } else {
                      setChooseAccounts([...chooseAccounts, account]);
                    }
                  }}
                >
                  <View className="flex flex-row px-[16px] h-[40px] items-center">
                    <View
                      className="w-[24px] h-[24px] rounded-full border-solid border-[1px] overflow-hidden flex justify-center items-center"
                      style={{
                        backgroundColor: isSelected ? 'transparent' : isInChoose ? theme.colors.surfaceBrand : theme.colors.surfaceCard,
                        borderColor: isSelected ? 'transparent' : isInChoose ? theme.colors.surfaceCard : theme.colors.surfaceBrand,
                      }}
                    >
                      <CheckIcon
                        className="flex-shrink-0 flex-grow-0"
                        color={isSelected ? theme.colors.surfaceBrand : isInChoose ? theme.colors.surfaceCard : 'transparent'}
                        width={18}
                        height={16}
                      />
                    </View>
                    <Text className="ml-[4px] mr-[6px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
                      {account.index + 1}
                    </Text>
                    <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
                      {shortenAddress(account.hexAddress)}
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

        <View className="mt-[16px] px-[12px] flex flex-row justify-between items-center">
          <ArrowLeft 
            className="flex-shrink-0 flex-grow-0" 
            color={pageIndex === 0 || inNext ? theme.colors.surfaceFourth : theme.colors.surfaceBrand} 
            width={12} 
            height={12} 
            onPress={() => setPageIndex((pre) => pre - 1)} 
          />
          <Text className="text-[16px] leading-tight" style={{ color: theme.colors.surfaceBrand }}>
            {chooseAccounts.length} address{chooseAccounts.length > 0 ? `(es)` : ''} selected
          </Text>
          <BaseButton containerStyle={{ marginTop: 'auto' }} onPress={() => setPageIndex((pre) => pre + 1)} disabled={inNext}>
            Next
          </BaseButton>
        </View>
        <BaseButton containerStyle={{ marginTop: 'auto' }} disabled={chooseAccounts.length === 0} onPress={handleClickNext} loading={inNext}>
          Next
        </BaseButton>
      </SafeAreaView>
    );
  }
);

export default HDManage;
