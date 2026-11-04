import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import BSIMDeviceSelectSheet from '@components/BSIM/BSIMDeviceSelectSheet';
import HourglassLoading from '@components/Loading/Hourglass';
import { SheetBody, SheetHeader } from '@components/Sheet';
import Text from '@components/Text';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import useInAsync from '@hooks/useInAsync';
import { styles as accountListStyles } from '@modules/AccountsList';
import createVault from '@pages/InitWallet/createVaultWithRouterParams';
import { showNotFindBSIMCardMessage } from '@pages/WayToInitWallet';
import ImportExistingWallet from '@pages/WayToInitWallet/ImportExistingWallet';
import { useTheme } from '@react-navigation/native';
import type { AddAnotherWalletStackName, StackScreenProps } from '@router/configs';
import { getHardwareWalletService, VaultType } from '@service/core';
import { useVaults } from '@service/vault';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

const AddAnotherWallet: React.FC<StackScreenProps<typeof AddAnotherWalletStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const closeAddAnotherWallet = useCallback(() => {
    if (navigation.isFocused()) navigation.goBack();
  }, [navigation]);

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
        await getHardwareWalletService().connectAndList(HARDWARE_WALLET_TYPES.BSIM, { deviceIdentifier });

        if (await createVault({ type: 'connectBSIM', bsimDeviceId: deviceIdentifier })) {
          closeAddAnotherWallet();
          showMessage({
            message: t('account.add.another.BSIM.success'),
            type: 'success',
            duration: 1500,
          });
        }
      } catch (error: any) {
        if (handleBSIMHardwareUnavailable(error, navigation)) {
          return;
        }
        showNotFindBSIMCardMessage();
      }
    },
    [closeAddAnotherWallet, navigation, t],
  );
  const { inAsync: inConnecting, execAsync: handleConnectBSIMCard } = useInAsync(_handleConnectBSIMCard);

  const _handleCreateNewHdWallet = useCallback(async () => {
    if (await createVault({ type: 'createNewWallet' })) {
      closeAddAnotherWallet();
      showMessage({
        message: t('account.add.another.create.success'),
        type: 'success',
        duration: 1500,
      });
    }
  }, [closeAddAnotherWallet, t]);
  const { inAsync: inCreating, execAsync: handleCreateNewHdWallet } = useInAsync(_handleCreateNewHdWallet);

  const _handleImportExistWallet = useCallback(
    async (value: string) => {
      const res = await createVault({ type: 'importExistWallet', value });
      if (res) {
        closeAddAnotherWallet();
        showMessage({
          message: t('account.add.another.import.success'),
          type: 'success',
          duration: 1500,
        });
      } else if (res === undefined) {
        setShowImportExistWallet(false);
      }
    },
    [closeAddAnotherWallet, t],
  );
  const { inAsync: inImporting, execAsync: handleImportExistWallet } = useInAsync(_handleImportExistWallet);
  const [showImportExistWallet, setShowImportExistWallet] = useState(false);

  const inAsync = inConnecting || inCreating || inImporting;
  return (
    <>
      <SheetHeader title={t('account.action.add.title')} />
      <SheetBody style={{ paddingHorizontal: 0 }}>
        {hasBSIMVaultCreated === false && (
          <Pressable
            style={({ pressed }) => [accountListStyles.row, { marginTop: 16, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            disabled={inAsync}
            onPress={Platform.OS === 'ios' ? () => setBsimSheetOpen(true) : () => handleConnectBSIMCard()}
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
          onPress={() => setShowImportExistWallet(true)}
          testID="importExistWallet"
        >
          {<Image style={accountListStyles.groupTypeImage} source={ExistWallet} />}
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('welcome.importExistingWallet')}</Text>
          {inImporting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
        </Pressable>
        <ImportExistingWallet
          isOpen={showImportExistWallet}
          onClose={() => setShowImportExistWallet(false)}
          onConfirm={handleImportExistWallet}
          inImporting={inImporting}
        />

        <BSIMDeviceSelectSheet
          isOpen={bsimSheetOpen}
          onClose={() => setBsimSheetOpen(false)}
          onConnect={handleConnectBSIMCard}
          onScanError={(error) => {
            if (handleBSIMHardwareUnavailable(error, navigation)) {
              return;
            }
            showNotFindBSIMCardMessage();
          }}
        />
      </SheetBody>
    </>
  );
};

export default AddAnotherWallet;
