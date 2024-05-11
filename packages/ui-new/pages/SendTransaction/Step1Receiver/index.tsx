import React, { useState, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Keyboard, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Trans, useTranslation } from 'react-i18next';
import { debounce, unionBy, escapeRegExp } from 'lodash-es';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { styles as listStyles } from './Contract/RecentlyList';
import {
  useCurrentNetwork,
  getCurrentNetwork,
  useRecentlyAddress,
  useAllAccountsInManage,
  AddressType,
  RecentlyType,
  NetworkType,
} from '@core/WalletCore/Plugins/ReactInject';
import method from '@core/WalletCore/Methods';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import { AccountItemView } from '@modules/AccountsList';
import ScanQRCode from '@pages/ScanQRCode';
import { SendTransactionStep1StackName, SendTransactionStep2StackName, type SendTransactionScreenProps } from '@router/configs';
import { type ETHURL } from '@utils/ETHURL';
import QrCodeIcon from '@assets/icons/qr-code.svg';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import SuccessIcon from '@assets/icons/success.svg';
import CopyIcon from '@assets/icons/copy.svg';
import ContractIcon from '@assets/icons/contract.svg';
import Contract from './Contract';

const SendTransactionStep1Receiver: React.FC<SendTransactionScreenProps<typeof SendTransactionStep1StackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const _currentNetwork = useCurrentNetwork();
  const [showScanQRCode, setShowScanQRCode] = useState(false);

  const recentlyAddress = useRecentlyAddress();
  const allAccounts = useAllAccountsInManage();
  const [receiver, setReceiver] = useState('');
  const [inFetchingRemote, setInFetchingRemote] = useState(false);
  const [knowRisk, setKnowRist] = useState(false);
  const [filterAccounts, setFilterAccounts] = useState<{
    type: 'local-filter' | 'local-valid' | AddressType | 'invalid' | 'network-error';
    assets: Array<{ nickname?: string; addressValue: string; source?: 'from' | 'to'; type?: RecentlyType }>;
  }>(() => ({ type: 'local-filter', assets: [] }));

  const searchFilterReceiver = useCallback(
    debounce(async (receiver: string) => {
      try {
        setKnowRist(false);
        setInFetchingRemote(false);
        if (!receiver) {
          setFilterAccounts({ type: 'local-filter', assets: [] });
          return;
        }
        const __localAccounts = [...allAccounts, ...recentlyAddress]?.filter((account) =>
          [account.nickname, account.addressValue].some((str) => (!str ? false : str?.search(new RegExp(escapeRegExp(receiver), 'i')) !== -1)),
        );
        const _localAccounts = unionBy(__localAccounts, 'addressValue');
        const localAccounts = _localAccounts.map((account) => ({
          nickname: account.nickname,
          addressValue: account.addressValue,
          source: (account as { source?: 'from' | 'to' })?.source,
          type: (account as { type?: RecentlyType })?.type ?? RecentlyType.Account,
        }));

        const currentNetwork = _currentNetwork ?? getCurrentNetwork()!;
        const isValidAddress = method.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: receiver });
        if (localAccounts?.length > 0) {
          if (isValidAddress) {
            const isInMyAccounts = allAccounts.some((account) => account.addressValue === receiver);
            if (!isInMyAccounts) {
              setFilterAccounts({ type: AddressType.EOA, assets: [] });
            } else {
              setFilterAccounts({ type: 'local-valid', assets: localAccounts });
            }
          } else {
            setFilterAccounts({ type: 'local-filter', assets: localAccounts });
          }
        } else {
          setInFetchingRemote(true);
          if (!isValidAddress) {
            setFilterAccounts({ type: 'invalid', assets: [] });
          } else {
            const isContractAddress = await method.checkIsContractAddress({
              networkType: currentNetwork.networkType,
              addressValue: receiver,
              endpoint: currentNetwork.endpoint,
            });
            setFilterAccounts({ type: isContractAddress ? AddressType.Contract : AddressType.EOA, assets: [] });
          }
        }
      } catch (err) {
        setFilterAccounts({ type: 'network-error', assets: [] });
      } finally {
        setInFetchingRemote(false);
      }
    }, 200),
    [recentlyAddress, allAccounts],
  );

  const handleCodeScan = useCallback(({ target_address }: ETHURL) => {
    setReceiver(target_address);
  }, []);

  useEffect(() => {
    searchFilterReceiver(receiver);
  }, [receiver, searchFilterReceiver]);

  const handlePressPaste = useCallback(async () => {
    const clipboardContent = await Clipboard.getString();
    setReceiver(clipboardContent);
  }, []);

  const handlePressScan = useCallback(() => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
    }
    setShowScanQRCode(true);
  }, []);

  return (
    <>
      <SendTransactionBottomSheet showTitle={t('tx.send.title')}>
        <Text style={[styles.receiver, { color: colors.textSecondary }]}>{t('tx.send.receiver')}</Text>
        <TextInput
          containerStyle={[
            styles.textInput,
            {
              borderColor: filterAccounts.type === 'invalid' ? colors.down : colors.borderFourth,
              borderBottomLeftRadius: !receiver ? 0 : 6,
              borderBottomRightRadius: !receiver ? 0 : 6,
            },
          ]}
          showVisible={false}
          defaultHasValue={false}
          value={receiver}
          onChangeText={(val) => setReceiver(val)}
          isInBottomSheet
          // TODO: this max length need consider network
          maxLength={200}
          showClear={!!receiver}
          placeholder={t('tx.send.placeholder')}
          multiline
          numberOfLines={3}
        />
        {!receiver && (
          <View style={[styles.inputActionArea, { borderColor: colors.borderFourth }]}>
            <Pressable style={[styles.inputAction, { justifyContent: 'flex-end', paddingRight: 44 }]} onPress={handlePressPaste} testID="paste">
              <CopyIcon style={styles.inputActionIcon} color={colors.textPrimary} width={16} height={16} />
              <Text style={[styles.inputActionText, { color: colors.textPrimary }]}>{t('tx.send.paste')}</Text>
            </Pressable>
            <Pressable style={[styles.inputAction, { justifyContent: 'flex-start', paddingLeft: 44 }]} onPress={handlePressScan} testID="scan">
              <QrCodeIcon style={styles.inputActionIcon} color={colors.textPrimary} width={16} height={16} />
              <Text style={[styles.inputActionText, { color: colors.textPrimary }]}>{t('tx.send.scan')}</Text>
            </Pressable>
          </View>
        )}

        {receiver && filterAccounts.type === 'local-valid' && (
          <View style={styles.checkResWarp}>
            <ContractIcon />
            <Text style={[styles.validMyAccount, { color: colors.textPrimary }]}>Account: {filterAccounts.assets?.[0]?.nickname}</Text>
          </View>
        )}
        {receiver && filterAccounts.type === 'local-filter' && (
          <>
            <BottomSheetFlatList
              style={listStyles.container}
              data={filterAccounts.assets}
              keyExtractor={(item) => item.addressValue}
              renderItem={({ item }) => (
                <AccountItemView
                  colors={colors}
                  nickname={item.nickname}
                  addressValue={item.addressValue}
                  onPress={() => {
                    if (Keyboard.isVisible()) {
                      Keyboard.dismiss();
                    }
                    setReceiver(item.addressValue);
                  }}
                />
              )}
            />
          </>
        )}
        {!receiver && <Contract setReceiver={setReceiver} />}
        {receiver && !filterAccounts.type.startsWith('local') && (
          <>
            {filterAccounts.type === 'network-error' && !inFetchingRemote && (
              <Pressable
                style={({ pressed }) => [styles.checkFail, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                onPress={() => searchFilterReceiver(receiver)}
                testID="tryAgain"
              >
                <Text style={[styles.checkFailText, { color: colors.down }]}>
                  <Trans i18nKey={'tx.send.error.failCheck'}>
                    Fail to check address, <Text style={{ textDecorationLine: 'underline' }}>click to try again</Text>.
                  </Trans>
                </Text>
              </Pressable>
            )}
            {inFetchingRemote && <HourglassLoading style={styles.checkLoading} />}
            {filterAccounts.type === AddressType.EOA && !inFetchingRemote && (
              <View style={styles.checkResWarp}>
                <SuccessIcon style={styles.checkIcon} color={colors.up} width={24} height={24} />
                <Text style={[styles.checkResText, { color: colors.up }]}>{t('tx.send.address.valid')}</Text>
              </View>
            )}
            {filterAccounts.type === 'invalid' && !inFetchingRemote && (
              <View style={styles.checkResWarp}>
                <ProhibitIcon style={styles.checkIcon} width={24} height={24} />
                <Text style={[styles.checkResText, { color: colors.down }]}>{t('tx.send.address.invalid')}</Text>
              </View>
            )}

            {filterAccounts.type === AddressType.Contract && !inFetchingRemote && (
              <View style={styles.contractAddress}>
                <Text style={[styles.contractAddressValid, { color: colors.textPrimary }]}>{t('tx.send.address.valid')}</Text>
                <Text style={[styles.contractAddressTip, { color: colors.textPrimary }]}>{t('tx.send.address.contractRisk')}</Text>
                <Pressable
                  style={({ pressed }) => [styles.knowRiskWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                  onPress={() => setKnowRist((pre) => !pre)}
                  testID="knowRisk"
                >
                  <Checkbox checked={knowRisk} pointerEvents="none" />
                  <Text style={(styles.contractAddressTip, { color: colors.textPrimary })}>{t('tx.send.address.contractRiskKnow')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {receiver && (filterAccounts.type === 'local-valid' || filterAccounts.type === AddressType.Contract || filterAccounts.type === AddressType.EOA) && (
          <Button
            testID="next"
            style={styles.btn}
            onPress={() => {
              navigation.navigate(SendTransactionStep2StackName, { targetAddress: receiver });
              if (Keyboard.isVisible()) {
                Keyboard.dismiss();
              }
            }}
            disabled={filterAccounts.type === AddressType.Contract && !knowRisk}
            size="small"
          >
            {t('common.next')}
          </Button>
        )}
      </SendTransactionBottomSheet>
      {showScanQRCode && <ScanQRCode onConfirm={handleCodeScan} onClose={() => setShowScanQRCode(false)} />}
    </>
  );
};

const styles = StyleSheet.create({
  receiver: {
    marginTop: 24,
    marginBottom: 16,
    marginLeft: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  textInput: {
    marginHorizontal: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
    minHeight: 88,
  },
  inputActionArea: {
    marginHorizontal: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  inputAction: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    height: '100%',
    gap: 12,
  },
  inputActionIcon: {
    transform: [{ translateY: 1 }],
  },
  inputActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkFail: {
    marginTop: 26,
    paddingVertical: 12,
  },
  checkFailText: {
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
  },
  checkLoading: {
    marginTop: 32,
    width: 48,
    height: 48,
    alignSelf: 'center',
  },
  checkResWarp: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 32,
  },
  checkIcon: {
    marginRight: 4,
  },
  checkResText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  validMyAccount: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
    marginLeft: 6,
  },
  contractAddress: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  contractAddressValid: {
    fontWeight: '400',
    lineHeight: 24,
    fontSize: 16,
  },
  contractAddressTip: {
    marginTop: 16,
    marginBottom: 18,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  knowRiskWrapper: {
    paddingVertical: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default SendTransactionStep1Receiver;
