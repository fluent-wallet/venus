import Button from '@components/Button';
import { SheetBody, SheetFooter, SheetHeader } from '@components/Sheet';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { useTheme } from '@react-navigation/native';
import { type EraseAllWalletStackName, type StackScreenProps, WelcomeStackName } from '@router/configs';
import { getAuthService, getWalletMaintenanceService } from '@service/core';
import { useDisconnectAllWalletConnectSessions } from '@service/walletConnect';
import { getErrorCode } from '@utils/error';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import RNRestart from 'react-native-restart';

const EraseAllWallet: React.FC<StackScreenProps<typeof EraseAllWalletStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const disconnectAllSessions = useDisconnectAllWalletConnectSessions();

  const handleDelete = useCallback(async () => {
    try {
      await getAuthService().getPassword();
      if (navigation.isFocused()) navigation.goBack();
      navigation.navigate(WelcomeStackName);
      try {
        await disconnectAllSessions();
      } catch (error) {
        console.warn('[EraseAllWallet] Failed to disconnect WalletConnect sessions before erasing wallet.', error);
      }
      await getWalletMaintenanceService().clearWalletData();
      await RNRestart.restart();
    } catch (err) {
      if (getErrorCode(err) === AUTH_PASSWORD_REQUEST_CANCELED) {
        return;
      }

      showMessage({
        message: t('account.error.deleteAccount.failed'),
        description: String(err ?? ''),
        type: 'warning',
      });
    }
  }, [disconnectAllSessions, navigation, t]);

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHeader title={t('account.action.eraseAll.title')} />
      <SheetBody>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.action.eraseAll.describe')}</Text>
      </SheetBody>
      <SheetFooter>
        <View style={styles.btnArea}>
          <Button testID="cancel" style={styles.btn} onPress={() => navigation.goBack()} size="small">
            {t('common.cancel')}
          </Button>
          <Button testID="delete" textColor="#fff" style={[styles.btn, { backgroundColor: colors.down }]} onPress={handleDelete} size="small">
            {t('common.delete')}
          </Button>
        </View>
      </SheetFooter>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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

export default EraseAllWallet;
