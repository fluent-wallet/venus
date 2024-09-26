import ExistWallet from '@assets/icons/wallet-Imported.webp';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import BottomSheet, { BottomSheetWrapper, BottomSheetContent, BottomSheetHeader, type BottomSheetMethods } from '@components/BottomSheet';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import plugins from '@core/WalletCore/Plugins';
import { useHasBSIMVaultCreated } from '@core/WalletCore/Plugins/ReactInject';
import useInAsync from '@hooks/useInAsync';
import { styles as accountListStyles } from '@modules/AccountsList';
import createVault from '@pages/InitWallet/createVaultWithRouterParams';
import { showNotFindBSIMCardMessage } from '@pages/WayToInitWallet';
import ImportExistingWallet from '@pages/WayToInitWallet/ImportExistingWallet';
import { useTheme } from '@react-navigation/native';
import type { AccountManagementStackName, StackScreenProps } from '@router/configs';
import { OS, screenHeight } from '@utils/deviceInfo';
import { SUPPORT_BSIM_FEATURE } from '@utils/features';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
}

const AddAnotherWallet: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const importExistRef = useRef<BottomSheetMethods>(null!);

  const hasBSIMVaultCreated = useHasBSIMVaultCreated();

  const _handleConnectBSIMCard = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await plugins.BSIM.getBSIMVersion();
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (await createVault({ type: 'connectBSIM' })) {
        setTimeout(() => bottomSheetRef.current?.close(), 50);
        showMessage({
          message: t('account.add.another.BSIM.success'),
          type: 'success',
          duration: 1500,
        });
      }
    } catch (error) {
      showNotFindBSIMCardMessage();
    } finally {
      navigation.setOptions({ gestureEnabled: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { inAsync: inConnecting, execAsync: handleConnectBSIMCard } = useInAsync(_handleConnectBSIMCard);

  const _handleCreateNewHdWallet = useCallback(async () => {
    navigation.setOptions({ gestureEnabled: false });
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (await createVault({ type: 'createNewWallet' })) {
      setTimeout(() => bottomSheetRef.current?.close(), 50);
      showMessage({
        message: t('account.add.another.create.success'),
        type: 'success',
        duration: 1500,
      });
    }
    navigation.setOptions({ gestureEnabled: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { inAsync: inCreating, execAsync: handleCreateNewHdWallet } = useInAsync(_handleCreateNewHdWallet);

  const _handleImportExistWallet = useCallback(async (value: string) => {
    navigation.setOptions({ gestureEnabled: false });
    await new Promise((resolve) => setTimeout(resolve, OS === 'ios' ? 150 : 20));
    const res = await createVault({ type: 'importExistWallet', value });
    if (res) {
      setTimeout(() => bottomSheetRef.current?.close(), 50);
      showMessage({
        message: t('account.add.another.import.success'),
        type: 'success',
        duration: 1500,
      });
    } else if (res === undefined) {
      importExistRef.current?.close();
    }
    navigation.setOptions({ gestureEnabled: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { inAsync: inImporting, execAsync: handleImportExistWallet } = useInAsync(_handleImportExistWallet);
  const [showImportExistWallet, setShowImportExistWallet] = useState(true);

  const inAsync = inConnecting || inCreating || inImporting;
  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        isRoute
        onClose={() => Platform.OS === 'android' && setShowImportExistWallet(false)}
        enablePanDownToClose={!inAsync}
        enableContentPanningGesture={!inAsync}
        enableHandlePanningGesture={!inAsync}
        backDropPressBehavior={inAsync ? 'none' : 'close'}
      >
        <BottomSheetWrapper>
          <BottomSheetHeader title={t('account.action.add.title')} />
          <BottomSheetContent>
            {SUPPORT_BSIM_FEATURE.allow && !hasBSIMVaultCreated && (
              <Pressable
                style={({ pressed }) => [accountListStyles.row, { marginTop: 16, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                disabled={inAsync}
                onPress={handleConnectBSIMCard}
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
      </BottomSheet>
      {showImportExistWallet && <ImportExistingWallet bottomSheetRef={importExistRef} onSuccessConfirm={handleImportExistWallet} inImporting={inImporting} />}
    </>
  );
};
export const snapPoints = [`${((306 / screenHeight) * 100).toFixed(2)}%`];

export default AddAnotherWallet;
