import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { debounce } from 'lodash-es';
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
import BottomSheet, { BottomSheetView, snapPoints } from '@components/BottomSheetNew';
import HourglassLoading from '@components/Loading/Hourglass';
import { HDSettingStackName, type StackScreenProps } from '@router/configs';
import { isSmallDevice } from '@utils/deviceInfo';
import ArrowRight from '@assets/icons/arrow-right2.svg';

const countPerPage = 5;
const defaultPages = Array.from({ length: countPerPage }).map((_, index) => ({ addressValue: '', index }));

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
  const [pageAccounts, setPageAccounts] = useState<Array<{ addressValue: string; index: number }>>(() => defaultPages);
  const [chooseAccounts, setChooseAccounts] = useState<Array<{ addressValue: string; index: number }>>([]);

  useEffect(() => {
    const visibleAccounts = accounts.filter((account) => !account.hidden);
    setChooseAccounts(visibleAccounts?.map((account) => ({ addressValue: account.addressValue, index: account.index })) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calcAccountsRef = useRef<() => void>(null!);
  const calcAccountsDebounce = useCallback(
    debounce(() => calcAccountsRef.current?.(), 360),
    [],
  );

  useEffect(() => {
    if (!currentHdPath?.value || !vault || !currentNetwork) {
      return;
    }
    calcAccountsRef.current = async () => {
      try {
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
        setInCalc(String(err));
        if (pageAccounts === defaultPages) {
          setPageAccounts([]);
        }
      }
    };

    calcAccountsDebounce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, mnemonic, currentHdPath?.value, _]);

  const handleClickNext = async () => {
    if (!accountGroup) return;
    try {
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

      await Promise.all(
        newAccountsInChoose.map((account) =>
          methods.addAccount({
            accountGroup,
            index: account.index,
            hexAddress: account.addressValue,
          }),
        ),
      );

      setInNext(false);
      navigation.goBack();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <BottomSheet snapPoints={snapPoints.large} isRoute>
      <BottomSheetView style={styles.container}>
        <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>Select HD Wallets</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>HD Path Type</Text>
        <Text style={[styles.contentText, styles.mainText, { color: colors.textPrimary }]}>BIP44</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>Index</Text>
        <Text style={[styles.contentText, styles.mainText, { color: colors.textPrimary }]}>{currentHdPath?.value}</Text>

        <View style={styles.selectArea}>
          {pageAccounts.map((account) => {
            const isSelected =
              pageAccounts !== defaultPages &&
              !!currentAddress &&
              (currentAddress.hex === account.addressValue || currentAddress.base32 === account.addressValue);
            const isInChoose = pageAccounts !== defaultPages && !!chooseAccounts?.find((_account) => _account.index === account.index);
            return (
              <Pressable
                key={account.index}
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
                <Checkbox
                  checked={false}
                  disabled
                  style={isSelected && styles.currentSelectCheck}
                  showBackgroundColor={isInChoose}
                  color={isSelected ? colors.up : isInChoose ? colors.iconFifth : 'transparent'}
                />
                <Text style={[styles.accountIndex, { color: colors.textPrimary }]}>{account.index + 1}</Text>
                <Text style={[styles.accountAddress, { color: colors.textPrimary }]}>{shortenAddress(account.addressValue)}</Text>
                <Text style={[styles.acccountPath, { color: colors.textSecondary }]}>
                  {currentHdPath?.value.slice(0, -1)}
                  {account.index}
                </Text>
              </Pressable>
            );
          })}
          {inCalc && (
            <View style={styles.selectAbsolute}>
              {inCalc === true && (
                <>
                  <View style={[styles.selectAbsolute, { backgroundColor: colors.bgFourth, opacity: 0.75 }]} pointerEvents="none" />
                  <HourglassLoading style={styles.calcLoading} />
                </>
              )}

              {typeof inCalc === 'string' && (
                <>
                  <View style={[styles.selectAbsolute, { backgroundColor: colors.bgFourth }]} />
                  {plugins.Authentication.containsCancel(String(inCalc)) ? (
                    <Pressable
                      onPress={() => forceAuth((pre) => !pre)}
                      style={({ pressed }) => [{ backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                    >
                      <Text style={[styles.selectText, { color: colors.textPrimary }]}>
                        You have not completed{'\n'}the security verification,
                        <Text style={styles.underline}> try again</Text>.
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.selectText, { color: colors.textPrimary }]}>{inCalc}</Text>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.pagination}>
          <Pressable
            onPress={() => setPageIndex((pre) => pre - 1)}
            style={({ pressed }) => [
              styles.paginationArrow,
              styles.arrowLeft,
              { backgroundColor: pressed ? colors.underlay : 'transparent', opacity: pageIndex <= 0 ? 0 : 1 },
            ]}
            disabled={inNext || pageIndex <= 0}
          >
            <ArrowRight color={pageIndex === 0 || inNext ? colors.up : colors.iconPrimary} width={12} height={12} />
          </Pressable>
          <Text style={[styles.paginationText, { color: colors.textPrimary }]}>
            {chooseAccounts.length} address{chooseAccounts.length > 0 ? `(es)` : ''} selected
          </Text>
          <Pressable
            onPress={() => setPageIndex((pre) => pre + 1)}
            style={({ pressed }) => [
              styles.paginationArrow,
              { backgroundColor: pressed ? colors.underlay : 'transparent', opacity: (pageIndex + 1) * countPerPage >= maxCountLimit ? 0 : 1 },
            ]}
            disabled={inNext || (pageIndex + 1) * countPerPage >= maxCountLimit}
          >
            <ArrowRight color={inNext ? colors.up : colors.iconPrimary} width={12} height={12} />
          </Pressable>
        </View>

        <Button style={styles.btn} disabled={chooseAccounts.length === 0} onPress={handleClickNext} loading={inNext}>
          Next
        </Button>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    marginBottom: isSmallDevice ? 12 : 24,
    textAlign: 'center',
  },
  mainText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: isSmallDevice ? 16 : 20,
  },
  description: {
    marginBottom: isSmallDevice ? 8 : 16,
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: isSmallDevice ? 14 : 18,
  },
  contentText: {
    marginBottom: 8,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectArea: {
    position: 'relative',
    marginVertical: isSmallDevice ? 10 : 20,
    height: 240,
  },
  selectAbsolute: {
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  selectText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'center',
    paddingVertical: 16,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  selectItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 32,
  },
  calcLoading: {
    width: 48,
    height: 48,
  },
  accountIndex: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    marginRight: 16,
  },
  accountAddress: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 'auto',
  },
  acccountPath: {
    fontSize: 14,
    fontWeight: '300',
  },
  currentSelectCheck: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  pagination: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  arrowLeft: {
    transform: [{ rotate: '180deg' }],
  },
  paginationArrow: {
    width: 40,
    height: 48,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationText: {
    minWidth: 196,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 40,
    marginHorizontal: 16,
  },
});

export default HDManagement;
