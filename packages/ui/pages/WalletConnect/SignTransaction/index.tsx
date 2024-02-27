import { Text, View, Image, StyleSheet, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@rneui/base';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useCurrentAccount, useCurrentAddressValueOfAccount, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { RootStackList, StackNavigation, WalletConnectSignTransactionStackName } from '@router/configs';
import { showMessage } from 'react-native-flash-message';
import { BaseButton } from '@components/Button';
import { Web3WalletTypes } from '@walletconnect/web3wallet';
import Methods from '@core/WalletCore/Methods';
import { isAddress } from 'ethers';
import SignMessage from './SignMessage';
import SignTransaction from './SignTransaction';
import useProvider from '@hooks/useProvider';
import VaultType from '@core/database/models/Vault/VaultType';

const WalletConnectSignTransactionSheet: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof WalletConnectSignTransactionStackName>;
}> = ({ navigation, route }) => {
  const snapPoints = useMemo(() => ['25%', '50%', '75%'], []);

  const { requestId } = route.params;
  // need to check if request is undefined
  const requestEvent = Methods.getRequestById(requestId)!;
  const { reject, request, resolve } = requestEvent;

  const payload = requestEvent.payload as Web3WalletTypes.SessionRequest['params'];

  const isSignMessage = ['personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'].includes(payload.request.method);

  const handleReject = useCallback(async () => {
    console.log('reject');
    try {
      await reject();
      navigation.goBack();
    } catch (error: any) {
      showMessage({
        message: error?.message || '',
        type: 'danger',
        duration: 3000,
      });
    }
  }, [navigation, reject]);

  const handleResolve = useCallback(
    async (hex: string) => {
      console.log('resolve');

      try {
        await resolve(hex);
        navigation.goBack();
      } catch (error: any) {
        showMessage({
          message: error?.message || '',
          type: 'danger',
          duration: 3000,
        });
      }
    },
    [navigation, resolve],
  );

  return (
    <View className="flex flex-1">
      <BottomSheet snapPoints={snapPoints} index={1} animateOnMount={true}>
        <BottomSheetScrollView style={{ flex: 1 }}>
          <View style={style.bottomSheet}>
            <View style={style.title}>
              {request.app.icon && <Image source={{ uri: request.app.icon }} style={{ width: 40, height: 40 }} />}
              <View>
                <Text>{request.app.name}</Text>
              </View>
            </View>
            <BottomSheetScrollView style={{ maxHeight: 300 }}>
              {isSignMessage ? (
                <SignMessage payload={payload} onSignMessage={handleResolve} onCancel={handleReject} />
              ) : (
                <SignTransaction payload={payload} onSignTx={handleResolve} onCancel={handleReject} />
              )}
            </BottomSheetScrollView>

            {/* <BaseButton testID="connect-wallet-connect" onPress={handleResolve}>
              Sign
            </BaseButton> */}
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};

const style = StyleSheet.create({
  bottomSheet: {
    padding: 16,
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
  },
});

export default WalletConnectSignTransactionSheet;
