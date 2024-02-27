import { Text, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@rneui/base';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useCurrentAccount, useCurrentAddressValueOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { BaseButton } from '@components/Button';
import { RootStackList, StackNavigation, WalletConnectApprovalSheetStackName } from '@router/configs';
import { showMessage } from 'react-native-flash-message';
import Methods from '@core/WalletCore/Methods';
import MixinImage from '@components/MixinImage';

const WalletConnectApprovalSheet: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof WalletConnectApprovalSheetStackName>;
}> = ({ navigation, route }) => {
  const snapPoints = useMemo(() => ['25%', '50%', '75%'], []);
  const { requestId } = route.params;
  // need to check if request is undefined
  const requestEvent = Methods.getRequestById(requestId)!;
  const { reject, request, resolve } = requestEvent;

  const account = useCurrentAccount();
  const address = useCurrentAddressValueOfAccount(account?.id);

  const bottomSheetRef = useRef<BottomSheet>(null);

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

  const handleResolve = useCallback(async () => {
    console.log('resolve');
    try {
      await resolve();
      navigation.goBack();
    } catch (error: any) {
      showMessage({
        message: error?.message || '',
        type: 'danger',
        duration: 3000,
      });
    }
  }, [navigation, resolve]);
  const { icon,name, origin } = request.app;
  return (
    <View className="flex flex-1">
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={1} animateOnMount={true}>
        <BottomSheetScrollView style={{ flex: 1 }}>
          {request.app.icon && (
            <View>
              <MixinImage source={{ uri: icon }} width={50} height={50} />
            </View>
          )}
          <View><Text>{name}</Text></View>
          <Text>{request.app.origin}</Text>
          <Text>连接此站点?</Text>
          <Text>单机连接即表示您允许次去中心化应用查看你的公钥。这是保护您的数据防范网络钓鱼风险的重要安全步骤。</Text>

          {account && address && (
            <Text>
              {account.nickname}
              {address}
            </Text>
          )}
          <View>
            <BaseButton testID="reject-wallet-connect" onPress={handleReject}>
              Cancel
            </BaseButton>

            <View className="mt-5">
              <BaseButton testID="connect-wallet-connect" onPress={handleResolve}>
                Connect
              </BaseButton>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};

export default WalletConnectApprovalSheet;
