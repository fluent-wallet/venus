import React, { useState, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Keyboard } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { debounce } from 'lodash-es';
import { useCurrentNetwork, getCurrentNetwork, AddressType } from '@core/WalletCore/Plugins/ReactInject';
import method from '@core/WalletCore/Methods';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import ScanQRCode from '@pages/ScanQRCode';
import { SendTransactionStep1StackName, SendTransactionStep2StackName, type SendTransactionScreenProps } from '@router/configs';
import QrCode from '@assets/icons/qr-code.svg';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import Contract from './Contract';

const SendTransactionStep1Receiver: React.FC<SendTransactionScreenProps<typeof SendTransactionStep1StackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const _currentNetwork = useCurrentNetwork();
  const [showScanQRCode, setShowScanQRCode] = useState(false);

  const [receiver, setReceiver] = useState('');
  const [inChecking, setInChecking] = useState(false);
  const [knowRisk, setKnowRist] = useState(false);
  const [checkRes, setCheckRes] = useState<null | AddressType | 'Invalid' | 'NetworkError'>(null);

  const checkReceiver = useCallback(
    debounce(async (receiver: string) => {
      try {
        if (!receiver) return;
        const currentNetwork = _currentNetwork ?? getCurrentNetwork()!;
        const isValidAddress = await method.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: receiver });
        if (!isValidAddress) {
          setCheckRes('Invalid');
        } else {
          const isContractAddress = await method.checkIsContractAddress({
            networkType: currentNetwork.networkType,
            addressValue: receiver,
            endpoint: currentNetwork.endpoint,
          });
          setCheckRes(isContractAddress ? AddressType.Contract : AddressType.EOA);
        }
      } catch (err) {
        setCheckRes('NetworkError');
      } finally {
        setInChecking(false);
      }
    }, 200),
    [],
  );

  useEffect(() => {
    setCheckRes(null);
    setKnowRist(false);
    if (receiver) {
      setInChecking(true);
      checkReceiver(receiver);
    } else {
      setInChecking(false);
    }
  }, [receiver, checkReceiver]);

  return (
    <>
      <SendTransactionBottomSheet>
        <Text style={[styles.receiver, { color: colors.textSecondary }]}>Receiver</Text>
        <TextInput
          containerStyle={[styles.textinput, { borderColor: checkRes === 'Invalid' ? colors.down : colors.borderFourth }]}
          showVisible={false}
          defaultHasValue={false}
          value={receiver}
          onChangeText={(newNickName) => setReceiver(newNickName?.trim())}
          isInBottomSheet
          SuffixIcon={!receiver ? QrCode : undefined}
          onPressSuffixIcon={() => {
            if (Keyboard.isVisible()) {
              Keyboard.dismiss();
            }
            setShowScanQRCode(true);
          }}
          showClear={!!receiver}
          placeholder="Enter an address"
          multiline
          numberOfLines={3}
        />
        {checkRes === 'NetworkError' && !inChecking && (
          <Pressable
            style={({ pressed }) => [styles.checkFail, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => checkReceiver(receiver)}
          >
            <Text style={[styles.checkFailText, { color: colors.down }]}>
              Fail to check address, <Text style={{ textDecorationLine: 'underline' }}>click to try again</Text>.
            </Text>
          </Pressable>
        )}
        {!checkRes && inChecking && <HourglassLoading style={styles.checkLoading} />}
        {(checkRes === AddressType.EOA || checkRes === AddressType.Contract || checkRes === 'Invalid') && (
          <Text style={[styles.checkRes, { color: colors.textPrimary }]}>
            {checkRes === 'Invalid' ? '🚫' : checkRes === AddressType.EOA ? '🎉' : '📑'}
            {'   '}
            {checkRes === 'Invalid' ? 'Invalid' : 'Valid'} Address
          </Text>
        )}
        {checkRes === AddressType.Contract && (
          <>
            <Text style={[styles.contractAddressTip, { color: colors.textPrimary }]}>
              This address is a contract address, and transferring to this address may result in asset loss.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.knowRiskWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              onPress={() => setKnowRist((pre) => !pre)}
            >
              <Checkbox checked={knowRisk} pointerEvents="none" />
              <Text style={(styles.contractAddressTip, { color: colors.textPrimary })}>Known the risks</Text>
            </Pressable>
          </>
        )}
        {/* <Contract setReceiver={setReceiver} /> */}
        <Button
          testID="next"
          style={styles.btn}
          onPress={() => {
            navigation.navigate(SendTransactionStep2StackName, { targetAddress: receiver });
            if (Keyboard.isVisible()) {
              Keyboard.dismiss();
            }
          }}
          disabled={!(checkRes === AddressType.EOA || checkRes === AddressType.Contract) || (checkRes === AddressType.Contract && !knowRisk)}
          size="small"
        >
          Next
        </Button>
      </SendTransactionBottomSheet>
      {showScanQRCode && <ScanQRCode onConfirm={(ethURL) => setReceiver(ethURL?.target_address ?? '')} onClose={() => setShowScanQRCode(false)} />}
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
  textinput: {
    marginHorizontal: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
    minHeight: 84
  },
  checkFail: {
    marginTop: 26,
    paddingVertical: 12,
  },
  checkFailText: {
    fontSize: 16,
    textAlign: 'center',
  },
  checkLoading: {
    marginTop: 32,
    width: 60,
    height: 60,
    alignSelf: 'center',
  },
  checkRes: {
    paddingHorizontal: 32,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 32,
  },
  contractAddressTip: {
    marginTop: 16,
    marginBottom: 18,
    paddingLeft: 64,
    paddingRight: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  knowRiskWrapper: {
    paddingHorizontal: 32,
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
