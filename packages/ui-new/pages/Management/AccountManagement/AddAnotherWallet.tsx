import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import { BottomSheetContent, BottomSheetHeader, type BottomSheetMethods, BottomSheetRoute, BottomSheetWrapper } from '@components/BottomSheet';
import BSIMDeviceSelectSheet from '@components/BSIM/BSIMDeviceSelectSheet';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import useInAsync from '@hooks/useInAsync';
import { styles as accountListStyles } from '@modules/AccountsList';
import { showNotFindBSIMCardMessage } from '@pages/WayToInitWallet';
import ImportExistingWallet from '@pages/WayToInitWallet/ImportExistingWallet';
import { useTheme } from '@react-navigation/native';
import type { AccountManagementStackName, StackScreenProps } from '@router/configs';
import { getHardwareWalletService, VaultType } from '@service/core';
import { useVaults } from '@service/vault';
import {
  executeWalletCreation,
  getWalletCreationDuplicateMessage,
  getWalletCreationUnknownMessage,
  type ImportWalletCreationRequest,
} from '@service/walletCreation';
import { OS, screenHeight } from '@utils/deviceInfo';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
}

function waitForUi(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AddAnotherWallet: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const importExistRef = useRef<BottomSheetMethods>(null!);
  const bsimDeviceSheetRef = useRef<BottomSheetMethods>(null!);

  const { data: vaults, isError: isVaultsError } = useVaults();
  const hasBSIMVaultCreated = useMemo(() => {
    if (isVaultsError) return false;
    if (!vaults) return null;
    return vaults.some((v) => v.type === VaultType.BSIM);
  }, [isVaultsError, vaults]);

  const [bsimSheetOpen, setBsimSheetOpen] = useState(false);

  const _handleConnectBSIMCard = useCallback(
    async (bsimDeviceId?: string | unknown) => {
      const deviceIdentifier = typeof bsimDeviceId === 'string' ? bsimDeviceId : undefined;
      try {
        navigation.setOptions({ gestureEnabled: false });
        await waitForUi(20);
        await getHardwareWalletService().connectAndList(HARDWARE_WALLET_TYPES.BSIM, { deviceIdentifier });
        await waitForUi(20);

        const result = await executeWalletCreation({ kind: 'connect_bsim', deviceIdentifier });

        if (result.status === 'success') {
          setTimeout(() => bottomSheetRef.current?.close(), 50);
          showMessage({
            message: t('account.add.another.BSIM.success'),
            type: 'success',
            duration: 1500,
          });
          return;
        }

        if (result.status === 'error') {
          if (handleBSIMHardwareUnavailable(result.error, navigation)) {
            return;
          }

          showMessage({
            message: getWalletCreationUnknownMessage(result.displayType),
            description: String(result.error ?? ''),
            type: 'failed',
          });
        }
      } catch (error: unknown) {
        if (handleBSIMHardwareUnavailable(error, navigation)) {
          return;
        }
        showNotFindBSIMCardMessage();
      } finally {
        navigation.setOptions({ gestureEnabled: true });
      }
    },
    [navigation, t],
  );
  const { inAsync: inConnecting, execAsync: handleConnectBSIMCard } = useInAsync(_handleConnectBSIMCard);

  const _handleCreateNewHdWallet = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      await waitForUi(20);

      const result = await executeWalletCreation({ kind: 'create_hd' });

      if (result.status === 'success') {
        setTimeout(() => bottomSheetRef.current?.close(), 50);
        showMessage({
          message: t('account.add.another.create.success'),
          type: 'success',
          duration: 1500,
        });
        return;
      }

      if (result.status === 'error') {
        showMessage({
          message: getWalletCreationUnknownMessage(result.displayType),
          description: String(result.error ?? ''),
          type: 'failed',
        });
      }
    } catch (error) {
      showMessage({
        message: t('initWallet.msg.failed'),
        description: String(error ?? ''),
        type: 'failed',
      });
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  }, [navigation, t]);
  const { inAsync: inCreating, execAsync: handleCreateNewHdWallet } = useInAsync(_handleCreateNewHdWallet);

  const _handleImportExistWallet = useCallback(
    async (request: ImportWalletCreationRequest) => {
      try {
        navigation.setOptions({ gestureEnabled: false });
        await waitForUi(OS === 'ios' ? 150 : 20);

        const result = await executeWalletCreation(request);

        if (result.status === 'success') {
          setTimeout(() => bottomSheetRef.current?.close(), 50);
          showMessage({
            message: t('account.add.another.import.success'),
            type: 'success',
            duration: 1500,
          });
          return;
        }

        if (result.status === 'duplicate') {
          showMessage({
            message: getWalletCreationDuplicateMessage(result.displayType),
            type: 'failed',
          });
          importExistRef.current?.close();
          return;
        }

        if (result.status === 'cancelled') {
          importExistRef.current?.close();
          return;
        }

        showMessage({
          message: getWalletCreationUnknownMessage(result.displayType),
          description: String(result.error ?? ''),
          type: 'failed',
        });
      } catch (error) {
        showMessage({
          message: t('initWallet.msg.failed'),
          description: String(error ?? ''),
          type: 'failed',
        });
      } finally {
        navigation.setOptions({ gestureEnabled: true });
      }
    },
    [navigation, t],
  );
  const { inAsync: inImporting, execAsync: handleImportExistWallet } = useInAsync(_handleImportExistWallet);
  const [showImportExistWallet, setShowImportExistWallet] = useState(true);

  const inAsync = inConnecting || inCreating || inImporting;
  const blockParentGestures = inAsync || bsimSheetOpen;
  return (
    <>
      <BottomSheetRoute
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onClose={() => Platform.OS === 'android' && setShowImportExistWallet(false)}
        enablePanDownToClose={!blockParentGestures}
        enableContentPanningGesture={!blockParentGestures}
        enableHandlePanningGesture={!blockParentGestures}
        backDropPressBehavior={blockParentGestures ? 'none' : 'close'}
      >
        <BottomSheetWrapper>
          <BottomSheetHeader title={t('account.action.add.title')} />
          <BottomSheetContent>
            {hasBSIMVaultCreated === false && (
              <Pressable
                style={({ pressed }) => [accountListStyles.row, { marginTop: 16, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                disabled={inAsync}
                onPress={Platform.OS === 'ios' ? () => bsimDeviceSheetRef.current?.expand() : () => handleConnectBSIMCard()}
                testID="connectBSIMWallet"
              >
                <Image style={accountListStyles.groupTypeImage} source={BSIMCardWallet} />
                <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('welcome.connectBSIMWallet')}</Text>
                {inConnecting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              disabled={inAsync}
              onPress={handleCreateNewHdWallet}
              testID="createNewWallet"
            >
              {<Image style={accountListStyles.groupTypeImage} source={HDWallet} />}
              <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('welcome.createNewWallet')}</Text>
              {inCreating && <HourglassLoading style={accountListStyles.addAccountLoading} />}
            </Pressable>

            <Pressable
              style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              disabled={inAsync}
              onPress={() => importExistRef.current?.expand()}
              testID="importExistWallet"
            >
              {<Image style={accountListStyles.groupTypeImage} source={ExistWallet} />}
              <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('welcome.importExistingWallet')}</Text>
              {inImporting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
            </Pressable>
          </BottomSheetContent>
        </BottomSheetWrapper>
      </BottomSheetRoute>
      {showImportExistWallet && <ImportExistingWallet bottomSheetRef={importExistRef} onSuccessConfirm={handleImportExistWallet} inImporting={inImporting} />}

      <BSIMDeviceSelectSheet
        bottomSheetRef={bsimDeviceSheetRef}
        onConnect={handleConnectBSIMCard}
        onOpenChange={setBsimSheetOpen}
        onScanError={(error) => {
          if (handleBSIMHardwareUnavailable(error, navigation)) {
            return;
          }
          showNotFindBSIMCardMessage();
        }}
      />
    </>
  );
};
export const snapPoints = [`${((306 / screenHeight) * 100).toFixed(2)}%`];

export default AddAnotherWallet;
