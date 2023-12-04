/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { Fragment, useEffect, useState, useMemo } from 'react';
import { SafeAreaView, View, ActivityIndicator, TouchableHighlight, Pressable } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme, Text, Card } from '@rneui/themed';
import VaultType from '@core/database/models/Vault/VaultType';
import database from '@core/database';
import { useAccountGroupFromId, useAccountsOfGroup, useVaultOfGroup, useCurrentAccount, useCurrentHdPath } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { shortenAddress } from '@core/utils/address';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { type RootStackList } from '@router/configs';
import { BaseButton } from '@components/Button';
import CheckIcon from '@assets/icons/check.svg';
import ArrowLeft from '@assets/icons/arrow-left.svg';

const HDManage: React.FC<NativeStackScreenProps<RootStackList, 'HDManage'>> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const accountGroup = useAccountGroupFromId(route.params.accountGroupId);
  const vault = useVaultOfGroup(route.params.accountGroupId);
  const accounts = useAccountsOfGroup(route.params.accountGroupId);
  const visibleAccounts = useMemo(() => accounts.filter((account) => !account.hidden), [accounts]);
  const currentAccount = useCurrentAccount();
  const currentHdPath = useCurrentHdPath();

  const [pageIndex, setPageIndex] = useState(0);
  const [mnemonic, setMnemonic] = useState('');
  const [inCalc, setInCalc] = useState(true);
  const [inNext, setInNext] = useState(false);
  const [pageAccounts, setPageAccounts] = useState<Array<{ hexAddress: string; index: number }>>([]);
  const [chooseAccounts, setChooseAccounts] = useState<Array<{ index: number }>>([]);

  useEffect(() => {
    const initChooseAccounts = async () => {
      setChooseAccounts(
        (await Promise.all(visibleAccounts.map(async (account) => ({ index: account.index, hexAddress: (await account.currentNetworkAddress)?.hex })))) ?? []
      );
    };

    initChooseAccounts();
  }, []);

  useEffect(() => {
    const calcAccounts = async () => {
      if (!currentHdPath?.value) return;
      setInCalc(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (vault.type === VaultType.HierarchicalDeterministic && !mnemonic) {
        setMnemonic(await methods.getMnemonicOfVault(vault));
        return;
      }

      let accountsList: Awaited<ReturnType<typeof plugins.BSIM.getBIMList>> = [];
      if (vault.type === 'BSIM') {
        await plugins.BSIM.createBSIMAccountToIndex((pageIndex + 1) * 5);
        accountsList = await plugins.BSIM.getBIMList();
      }

      const newPageAccounts = await Promise.all(
        Array.from({ length: 5 }, (_, i) => (vault.type === VaultType.BSIM ? i + 1 : i)).map(async (index) => {
          // BSIM index is  start from 1 other start from 0
          const targetAlreadyInAccounts = accounts?.find((account) => account.index === pageIndex * 5 + index);
          if (targetAlreadyInAccounts) return { hexAddress: (await targetAlreadyInAccounts.currentNetworkAddress).hex, index: targetAlreadyInAccounts.index };
          if (vault.type === VaultType.BSIM) {
            const targetAlreadyInList = accountsList?.find((account) => account.index === pageIndex * 5 + index);
            if (targetAlreadyInList) return { hexAddress: targetAlreadyInList.hexAddress, index: targetAlreadyInList.index };

            // The code shouldn't have been able to get here.
            const { hexAddress, index: newIndex } = await plugins.BSIM.createNewBSIMAccount();
            if (newIndex === pageIndex * 5 + index) {
              return { hexAddress, index: newIndex };
            }
            throw new Error('????');
          } else {
            return getNthAccountOfHDKey({ mnemonic, hdPath: currentHdPath.value, nth: pageIndex * 5 + index });
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
  }, [pageIndex, mnemonic, currentHdPath?.value]);

  const handleClickNext = async () => {
    setInNext(true);
    const newAccountsInChoose = chooseAccounts
      .filter((account) => !accounts.find((_account) => _account.index === account.index))
      .sort((a, b) => a.index - b.index);
    const oldAccountsNeedHidden = accounts.filter((account) => !chooseAccounts.find((_account) => _account.index === account.index));
    const oldAccountsNeedShow = accounts.filter((account) => !!chooseAccounts.find((_account) => _account.index === account.index));
    await database.write(async () => {
      await database.batch(
        ...oldAccountsNeedHidden.map((account) => methods.prepareChangeAccountHidden({ account, hidden: true })),
        ...oldAccountsNeedShow.map((account) => methods.prepareChangeAccountHidden({ account, hidden: false }))
      );
    });

    newAccountsInChoose.forEach(async (account) => {
      try {
        methods.addAccount({
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
          <Text style={{ color: theme.colors.textSecondary }}>{currentHdPath?.value}</Text>
        </View>
      </View>
      <View className="mt-[16px] relative py-[8px] min-h-[284px] rounded-[8px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
        {inCalc && (
          <View className="absolute left-0 top-0 w-full h-full bg-transparent flex justify-center items-center">
            <ActivityIndicator size={40} color={theme.colors.surfaceBrand} />
          </View>
        )}
        {pageAccounts.map((account, index) => {
          const isSelected = !!currentAccount && currentAccount.index === account.index;
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
                    {currentHdPath?.value.slice(0, -1)}
                    {account.index}
                  </Text>
                </View>
              </TouchableHighlight>
            </Fragment>
          );
        })}
      </View>

      <View className="mt-[16px] px-[12px] flex flex-row justify-between items-center">
        <Pressable onPress={() => pageIndex > 0 && setPageIndex((pre) => pre - 1)}>
          <View className="flex justify-center items-center w-6 h-6 flex-shrink-0 flex-grow-0">
            {pageIndex > 0 && <ArrowLeft color={pageIndex === 0 || inNext ? theme.colors.surfaceFourth : theme.colors.surfaceBrand} width={12} height={12} />}
          </View>
        </Pressable>
        <Text className="text-[16px] leading-tight" style={{ color: theme.colors.surfaceBrand }}>
          {chooseAccounts.length} address{chooseAccounts.length > 0 ? `(es)` : ''} selected
        </Text>
        <Pressable onPress={() => setPageIndex((pre) => pre + 1)}>
          <View className="flex justify-center items-center  w-6 h-6 flex-shrink-0 flex-grow-0 transform rotate-[180deg]">
            <ArrowLeft color={inNext ? theme.colors.surfaceFourth : theme.colors.surfaceBrand} width={12} height={12} />
          </View>
        </Pressable>
      </View>
      <BaseButton containerStyle={{ marginTop: 'auto' }} disabled={chooseAccounts.length === 0} onPress={handleClickNext} loading={inNext}>
        Next
      </BaseButton>
    </SafeAreaView>
  );
};
export default HDManage;
