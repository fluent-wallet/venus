import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, BottomSheetFooter, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useTheme } from '@react-navigation/native';
import { type AccountManagementStackName, type StackScreenProps, WelcomeStackName } from '@router/configs';
import { screenHeight } from '@utils/deviceInfo';
import { isAuthenticationCanceledError, isAuthenticationError } from '@WalletCoreExtends/Plugins/Authentication/errors';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import RNRestart from 'react-native-restart';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
}

const EraseAllWallet: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const handleDelete = useCallback(async () => {
    try {
      await plugins.Authentication.getPassword();
      bottomSheetRef.current?.close();
      navigation.navigate(WelcomeStackName);
      await plugins.WalletConnect.removeAllSession();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await methods.clearAccountData();
      await RNRestart.restart();
    } catch (err) {
      if (isAuthenticationError(err) && isAuthenticationCanceledError(err)) {
        return;
      }

      showMessage({
        message: t('account.error.deleteAccount.failed'),
        description: String(err ?? ''),
        type: 'warning',
      });
    }
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isRoute>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('account.action.eraseAll.title')} />
        <BottomSheetContent>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.action.eraseAll.describe')}</Text>
        </BottomSheetContent>
        <BottomSheetFooter>
          <View style={styles.btnArea}>
            <Button testID="cancel" style={styles.btn} onPress={() => bottomSheetRef.current?.close()} size="small">
              {t('common.cancel')}
            </Button>
            <Button testID="delete" textColor="#fff" style={[styles.btn, { backgroundColor: colors.down }]} onPress={handleDelete} size="small">
              {t('common.delete')}
            </Button>
          </View>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  description: {
    marginTop: 16,
    marginBottom: 32,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

const snapPoints = [`${((400 / screenHeight) * 100).toFixed(2)}%`];

export default EraseAllWallet;
