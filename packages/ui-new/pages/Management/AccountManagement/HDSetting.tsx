import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import {
  useAccountGroupFromId,
  useAccountsOfGroupInManage,
  useVaultOfGroup,
  useCurrentAddress,
  useCurrentHdPath,
  useCurrentNetwork,
  VaultType,
} from '@core/WalletCore/Plugins/ReactInject';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { getAddressValueByNetwork } from '@core/database/models/Address/query';
import database from '@core/database';
import { queryAccountById } from '@core/database/models/Account/query';
import { shortenAddress } from '@core/utils/address';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import Button from '@components/Button';
import BottomSheet, { BottomSheetScrollView } from '@components/BottomSheet';
import { HDSettingStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right2.svg';

const countPerPage = 5;

const HDManagement: React.FC<StackScreenProps<typeof HDSettingStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();

  const accountGroup = useAccountGroupFromId(route.params.groupId);
  const accounts = useAccountsOfGroupInManage(route.params.groupId);
  const currentAddress = useCurrentAddress();
  const currentNetwork = useCurrentNetwork();
  const currentHdPath = useCurrentHdPath();
  const vault = useVaultOfGroup(route.params.groupId);
  const maxCountLimit = useMemo(() => (vault?.type === VaultType.BSIM ? plugins.BSIM.chainLimtCount : 255), [vault?.type]);

  const [pageIndex, setPageIndex] = useState(0);
  const [_, forceAuth] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [inCalc, setInCalc] = useState<string | boolean>(true);
  const [inNext, setInNext] = useState(false);
  const [pageAccounts, setPageAccounts] = useState<Array<{ addressValue: string; index: number }>>([]);
  const [chooseAccounts, setChooseAccounts] = useState<Array<{ index: number }>>([]);

  useEffect(() => {
    const visibleAccounts = accounts.filter((account) => !account.hidden);
    setChooseAccounts(visibleAccounts?.map((account) => ({ addressValue: account.addressValue, index: account.index })) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const calcAccounts = async () => {
      try {
        if (!currentHdPath?.value || !vault || !currentNetwork) {
          return;
        }
        setInCalc(true);
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (vault.type === VaultType.HierarchicalDeterministic && !mnemonic) {
          setMnemonic(await methods.getMnemonicOfVault(vault));
          return;
        }

        let accountsList: Awaited<ReturnType<typeof plugins.BSIM.getBSIMList>> = [];
        if (vault.type === 'BSIM') {
          await plugins.BSIM.createBSIMAccountToIndex((pageIndex + 1) * countPerPage);
          accountsList = await plugins.BSIM.getBSIMList();
        }
        const newPageAccounts = await Promise.all(
          Array.from({ length: countPerPage }).map(async (_, index) => {
            const targetAlreadyInAccounts = accounts?.find((account) => account.index === pageIndex * countPerPage + index);
            if (targetAlreadyInAccounts) return { addressValue: targetAlreadyInAccounts.addressValue, index: targetAlreadyInAccounts.index };
            if (vault.type === VaultType.BSIM) {
              const targetAlreadyInList = accountsList?.find((account) => account.index === pageIndex * countPerPage + index);
              if (targetAlreadyInList)
                return { addressValue: getAddressValueByNetwork(targetAlreadyInList.hexAddress, currentNetwork), index: targetAlreadyInList.index };

              // The code shouldn't have been able to get here.
              // const { hexAddress, index: newIndex } = await plugins.BSIM.createNewBSIMAccount();
              // if (newIndex === pageIndex * countPerPage + index) {
              //   return { hexAddress, index: newIndex };
              // }
              throw new Error('Unexpected errors.');
            } else {
              return getNthAccountOfHDKey({ mnemonic, hdPath: currentHdPath.value, nth: pageIndex * countPerPage + index }).then((res) => ({
                addressValue: getAddressValueByNetwork(res.hexAddress, currentNetwork),
                index: res.index,
              }));
            }
          }),
        );
        setPageAccounts(newPageAccounts);
        setInCalc(false);
      } catch (err) {
        console.log('err');
        setInCalc(String(err));
      }
    };
    calcAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, mnemonic, currentHdPath?.value, _]);

  const handleClickNext = async () => {
    if (!accountGroup) return;
    setInNext(true);
    const newAccountsInChoose = chooseAccounts
      .filter((account) => !accounts.find((_account) => _account.index === account.index))
      .sort((a, b) => a.index - b.index);
    const _oldAccountsNeedHidden = accounts.filter((account) => !chooseAccounts.find((_account) => _account.index === account.index));
    const _oldAccountsNeedShow = accounts.filter((account) => !!chooseAccounts.find((_account) => _account.index === account.index));
    const oldAccountsNeedHidden = await Promise.all(_oldAccountsNeedHidden.map((account) => queryAccountById(account.id)));
    const oldAccountsNeedShow = await Promise.all(_oldAccountsNeedShow.map((account) => queryAccountById(account.id)));

    await database.write(async () => {
      await database.batch(
        ...oldAccountsNeedHidden.map((account) => methods.prepareChangeAccountHidden({ account, hidden: true })),
        ...oldAccountsNeedShow.map((account) => methods.prepareChangeAccountHidden({ account, hidden: false })),
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
    <BottomSheet snapPoints={snapPoints} index={0} animateOnMount={true} isModal={false} onClose={() => navigation.goBack()}>
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>Select HD Wallets</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>HD Path Type</Text>
        <Text style={[styles.address, styles.mainText]}>BIP44</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>Index</Text>
        <Text style={[styles.address, styles.mainText]}>{currentHdPath?.value}</Text>

        <View style={styles.selectArea}>
          {/* {inCalc && (
            <View className="absolute left-0 top-0 w-full h-full px-[16px] bg-transparent flex justify-center items-center">
              {inCalc === true && <ActivityIndicator size={40} color={theme.colors.surfaceBrand} />}
              {typeof inCalc === 'string' && (
                <>
                  {plugins.Authentication.containsCancel(String(inCalc)) ? (
                    <Pressable onPress={() => forceAuth((pre) => !pre)}>
                      <Text className="text-center text-[16px]" style={{ color: theme.colors.textPrimary }}>
                        You have not completed the security verification,{'\n'}
                        <Text className="underline">try again</Text>.
                      </Text>
                    </Pressable>
                  ) : (
                    <Text className="text-[16px]" style={{ color: theme.colors.error }}>
                      {inCalc}
                    </Text>
                  )}
                </>
              )}
            </View>
          )} */}
          {pageAccounts.map((account) => {
            const isSelected = !!currentAddress && (currentAddress.hex === account.addressValue || currentAddress.base32 === account.addressValue);
            const isInChoose = !!chooseAccounts?.find((_account) => _account.index === account.index);
            return (
              <Fragment key={account.index}>
                <Pressable
                  testID="addressItem"
                  style={({ pressed }) => [styles.selectItem, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                  disabled={isSelected}
                  onPress={() => {
                    if (chooseAccounts.find((_account) => _account.index === account.index)) {
                      setChooseAccounts(chooseAccounts.filter((_account) => _account.index !== account.index));
                    } else {
                      setChooseAccounts([...chooseAccounts, account]);
                    }
                  }}
                >
                  <Checkbox checked={isInChoose} disabled />
                  <Text style={{ color: colors.textPrimary }}>{account.index + 1}</Text>
                  <Text style={{ color: colors.textPrimary }}>{shortenAddress(account.addressValue)}</Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {currentHdPath?.value.slice(0, -1)}
                    {account.index}
                  </Text>
                </Pressable>
              </Fragment>
            );
          })}
        </View>

        <View>
          {pageIndex > 0 && (
            <Pressable onPress={() => setPageIndex((pre) => pre - 1)}>
              <View>
                <ArrowRight color={pageIndex === 0 || inNext ? colors.up : colors.iconPrimary} width={12} height={12} />
              </View>
            </Pressable>
          )}
          <Text style={{ color: colors.textPrimary }}>
            {chooseAccounts.length} address{chooseAccounts.length > 0 ? `(es)` : ''} selected
          </Text>
          {(pageIndex + 1) * countPerPage < maxCountLimit && (
            <Pressable onPress={() => setPageIndex((pre) => pre + 1)}>
              <View>
                <ArrowRight color={inNext ? colors.up : colors.iconPrimary} width={12} height={12} />
              </View>
            </Pressable>
          )}
        </View>

        <Button style={styles.btn} mode="auto" disabled={chooseAccounts.length === 0} onPress={handleClickNext} loading={inNext}>
          Next
        </Button>
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: 24,
    lineHeight: 40,
    textAlign: 'center',
  },
  mainText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  description: {
    marginBottom: 16,
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  address: {
    marginBottom: 32,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectArea: {
    marginTop: 28,
    marginBottom: 20,
  },
  selectItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 80,
    marginHorizontal: 16,
  },
});

const snapPoints = ['90%'];

export default HDManagement;
