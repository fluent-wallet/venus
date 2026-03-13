import ArrowRight from '@assets/icons/arrow-right2.svg';
import {
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetRoute,
  BottomSheetScrollContent,
  BottomSheetWrapper,
  snapPoints,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { BSIM_MANAGEMENT_ACCOUNT_LIMIT } from '@core/hardware/bsim/constants';
import { NetworkType } from '@core/types';
import { toChecksum } from '@core/utils/account';
import { convertHexToBase32, shortenAddress } from '@core/utils/address';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { useTheme } from '@react-navigation/native';
import type { HDSettingStackName, StackScreenProps } from '@router/configs';
import { useAccountsOfGroup, useApplyGroupVisibleIndexes } from '@service/account';
import { useAccountGroup } from '@service/accountGroup';
import { getAuthService, getHardwareWalletService, getVaultService, VaultType } from '@service/core';
import { useCurrentHdPath, useCurrentNetwork } from '@service/network';
import { isSmallDevice } from '@utils/deviceInfo';
import { getErrorCode } from '@utils/error';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { debounce } from 'lodash-es';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

const countPerPage = 5;
const defaultPages = Array.from({ length: countPerPage }).map((_, index) => ({ addressValue: '', index }));

function convertHexToNetworkAddress(params: { hex: string; networkType: NetworkType; netId: number }): string {
  const checksum = toChecksum(params.hex);
  return params.networkType === NetworkType.Conflux ? convertHexToBase32(checksum, params.netId) : checksum;
}

const HDManagement: React.FC<StackScreenProps<typeof HDSettingStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);
  const { t } = useTranslation();

  const { data: accountGroup } = useAccountGroup(route.params.groupId, true);
  const { data: accounts = [] } = useAccountsOfGroup(route.params.groupId, true);
  const { data: currentNetwork } = useCurrentNetwork();
  const { data: currentHdPath } = useCurrentHdPath();
  const applyVisible = useApplyGroupVisibleIndexes();

  const maxCountLimit = useMemo(() => {
    if (!accountGroup) return 0;
    return accountGroup.vaultType === VaultType.BSIM ? BSIM_MANAGEMENT_ACCOUNT_LIMIT : 255;
  }, [accountGroup]);

  const [pageIndex, setPageIndex] = useState(0);
  const [mnemonic, setMnemonic] = useState('');
  const [inCalc, setInCalc] = useState<string | boolean>(true);
  const [inNext, setInNext] = useState(false);
  const [pageAccounts, setPageAccounts] = useState<Array<{ addressValue: string; index: number }>>(() => defaultPages);
  const [chooseAccounts, setChooseAccounts] = useState<Array<{ addressValue: string; index: number }>>([]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (!accounts.length) return;
    const visibleAccounts = accounts.filter((account) => !account.hidden);
    setChooseAccounts(visibleAccounts.map((account) => ({ addressValue: account.address, index: account.index })));
    initializedRef.current = true;
  }, [accounts]);

  const calcAccountsRef = useRef<() => void>(() => undefined);
  const calcAbortRef = useRef<AbortController | null>(null);
  const calcAccountsDebounce = useCallback(
    debounce(() => calcAccountsRef.current(), 360),
    [],
  );

  useEffect(() => {
    if (!accountGroup || !currentNetwork) return;
    const hdPathValue = currentHdPath?.value ?? '';
    if (accountGroup.vaultType === VaultType.HierarchicalDeterministic && hdPathValue === '') return;

    calcAccountsRef.current = async () => {
      const controller = new AbortController();
      calcAbortRef.current?.abort();
      calcAbortRef.current = controller;

      try {
        setInCalc(true);
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (controller.signal.aborted) return;

        if (accountGroup.vaultType === VaultType.HierarchicalDeterministic && !mnemonic) {
          const password = await getAuthService().getPassword();
          const phrase = await getVaultService().getMnemonic(accountGroup.vaultId, password);
          if (controller.signal.aborted) return;
          setMnemonic(phrase);
          return;
        }

        const base = pageIndex * countPerPage;
        const pageIndexes = Array.from({ length: countPerPage }).map((_, offset) => base + offset);

        const existingByIndex = new Map(accounts.map((account) => [account.index, account] as const));
        const missing = pageIndexes.filter((idx) => !existingByIndex.has(idx));

        let derivedByIndex = new Map<number, string>();
        if (missing.length && accountGroup.vaultType === VaultType.BSIM) {
          const derived = await getHardwareWalletService().deriveBsimAccounts(accountGroup.vaultId, missing, { signal: controller.signal });
          derivedByIndex = new Map(
            derived.map((acc) => [
              acc.index,
              convertHexToNetworkAddress({ hex: acc.address, networkType: currentNetwork.networkType, netId: currentNetwork.netId }),
            ]),
          );
        }

        const newPageAccounts = await Promise.all(
          pageIndexes.map(async (idx) => {
            const existing = existingByIndex.get(idx);
            if (existing) return { addressValue: existing.address, index: existing.index };

            if (accountGroup.vaultType === VaultType.BSIM) {
              const addressValue = derivedByIndex.get(idx);
              if (!addressValue) throw new Error('Unexpected errors.');
              return { addressValue, index: idx };
            }

            const res = await getNthAccountOfHDKey({ mnemonic, hdPath: hdPathValue, nth: idx });
            return {
              addressValue: convertHexToNetworkAddress({ hex: res.hexAddress, networkType: currentNetwork.networkType, netId: currentNetwork.netId }),
              index: res.index,
            };
          }),
        );

        if (controller.signal.aborted) return;
        setPageAccounts(newPageAccounts);
        setInCalc(false);
      } catch (err: unknown) {
        if (handleBSIMHardwareUnavailable(err, navigation)) {
          return;
        }

        const code = getErrorCode(err);
        if (code === AUTH_PASSWORD_REQUEST_CANCELED) {
          setInCalc(code);
          return;
        }

        setInCalc(String(err ?? t('common.error')));
      }
    };

    calcAccountsDebounce();
    return () => {
      calcAbortRef.current?.abort();
      calcAbortRef.current = null;
    };
  }, [accountGroup, accounts, currentHdPath, currentNetwork, mnemonic, pageIndex, calcAccountsDebounce, navigation, t]);

  const handleClickNext = useCallback(async () => {
    if (!accountGroup) return;
    try {
      setInNext(true);
      const visibleIndexes = chooseAccounts.map((acc) => acc.index);

      if (accountGroup.vaultType === VaultType.HierarchicalDeterministic) {
        if (!mnemonic) {
          const password = await getAuthService().getPassword();
          setMnemonic(await getVaultService().getMnemonic(accountGroup.vaultId, password));
          return;
        }
        await applyVisible({ accountGroupId: accountGroup.id, visibleIndexes, mnemonic });
      } else {
        await applyVisible({ accountGroupId: accountGroup.id, visibleIndexes });
      }

      bottomSheetRef.current?.close();
    } catch (err) {
      if (getErrorCode(err) === AUTH_PASSWORD_REQUEST_CANCELED) {
        return;
      }
      console.error(err);
    } finally {
      setInNext(false);
    }
  }, [accountGroup, chooseAccounts, applyVisible, mnemonic]);

  const currentAddressValue = useMemo(() => {
    const selected = accounts.find((account) => account.selected);
    return selected?.address ?? '';
  }, [accounts]);

  if (!accountGroup || !currentNetwork) return null;

  return (
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={snapPoints.large}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('account.HDWallet.select.title')} />
        <BottomSheetScrollContent>
          <Text style={[styles.description, { marginTop: 14, color: colors.textSecondary }]}>{t('account.HDWallet.select.pathType')}</Text>
          <Text style={[styles.contentText, styles.mainText, { color: colors.textPrimary }]}>BIP44</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('common.index')}</Text>
          <Text style={[styles.contentText, styles.mainText, { color: colors.textPrimary }]}>{currentHdPath?.value ?? '--'}</Text>

          <View style={styles.selectArea}>
            {pageAccounts.map((account) => {
              const isSelected = pageAccounts !== defaultPages && !!currentAddressValue && currentAddressValue === account.addressValue;
              const isInChoose = pageAccounts !== defaultPages && !!chooseAccounts.find((_account) => _account.index === account.index);
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
                  <Checkbox checked={isInChoose} showBorder={!isSelected} pointerEvents="none" />
                  <Text style={[styles.accountIndex, { color: colors.textPrimary }]}>{account.index + 1}</Text>
                  <Text style={[styles.accountAddress, { color: colors.textPrimary }]}>{shortenAddress(account.addressValue)}</Text>
                  <Text style={[styles.acccountPath, { color: colors.textSecondary }]}>
                    {(currentHdPath?.value ?? "m/44'/60'/0'/0/").slice(0, -1)}
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
                    {inCalc === AUTH_PASSWORD_REQUEST_CANCELED ? (
                      <Pressable
                        onPress={() => {
                          setInCalc(true);
                          calcAccountsDebounce();
                        }}
                        style={({ pressed }) => [{ backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                        testID="tryAgain"
                      >
                        <Text style={[styles.selectText, { color: colors.textPrimary }]}>
                          <Trans i18nKey={'account.HDWallet.select.noVerification'}>
                            You have not completed{'\n'}the security verification,<Text style={styles.underline}> try again</Text>.
                          </Trans>
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
              onPress={() => setPageIndex((pre) => Math.max(pre - 1, 0))}
              style={({ pressed }) => [
                styles.paginationArrow,
                styles.arrowLeft,
                { backgroundColor: pressed ? colors.underlay : 'transparent', opacity: pageIndex <= 0 ? 0 : 1 },
              ]}
              disabled={inNext || pageIndex <= 0}
              testID="previous"
            >
              <ArrowRight color={pageIndex === 0 || inNext ? colors.up : colors.iconPrimary} width={12} height={12} />
            </Pressable>
            <Text style={[styles.paginationText, { color: colors.textPrimary }]}>
              {t('account.HDWallet.select.selected', { accounts: chooseAccounts.length, es: chooseAccounts.length > 0 ? '(es)' : '' })}
            </Text>
            <Pressable
              onPress={() => setPageIndex((pre) => Math.min(pre + 1, Math.floor(maxCountLimit / countPerPage) - 1))}
              style={({ pressed }) => [
                styles.paginationArrow,
                { backgroundColor: pressed ? colors.underlay : 'transparent', opacity: (pageIndex + 1) * countPerPage >= maxCountLimit ? 0 : 1 },
              ]}
              disabled={inNext || (pageIndex + 1) * countPerPage >= maxCountLimit}
              testID="next"
            >
              <ArrowRight color={inNext ? colors.up : colors.iconPrimary} width={12} height={12} />
            </Pressable>
          </View>
        </BottomSheetScrollContent>
        <BottomSheetFooter>
          <Button testID="next" disabled={chooseAccounts.length === 0} onPress={handleClickNext} loading={inNext} size="small">
            {t('common.next')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

const styles = StyleSheet.create({
  mainText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: isSmallDevice ? 16 : 20,
  },
  description: {
    marginBottom: isSmallDevice ? 8 : 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: isSmallDevice ? 14 : 18,
  },
  contentText: {
    marginBottom: 8,
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
  },
  underline: {
    textDecorationLine: 'underline',
  },
  selectItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
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
    lineHeight: 44,
  },
});

export default HDManagement;
