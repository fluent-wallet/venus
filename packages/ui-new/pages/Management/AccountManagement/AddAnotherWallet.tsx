import React, { useCallback, useRef, type MutableRefObject } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { Image } from 'expo-image';
import plugins from '@core/WalletCore/Plugins';
import { useHasBSIMVaultCreated } from '@core/WalletCore/Plugins/ReactInject';
import useInAsync from '@hooks/useInAsync';
import Text from '@components/Text';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import HourglassLoading from '@components/Loading/Hourglass';
import { styles as accountListStyles } from '@modules/AccountsList';
import { showNotFindBSIMCardMessage } from '@pages/WayToInitWallet';
import ImportExistingWallet from '@pages/WayToInitWallet/ImportExistingWallet';
import { AccountManagementStackName, type StackScreenProps } from '@router/configs';
import BSIMCard from '@assets/icons/bsim-card-noshadow.webp';
import createVault from '@pages/InitWallet/createVaultWithRouterParams';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
}

const AddAnotherWallet: React.FC<Props> = ({ navigation, bottomSheetRef }) => {
  const { colors } = useTheme();
  const importExistRef = useRef<BottomSheetMethods>(null!);

  const hasBSIMVaultCreated = useHasBSIMVaultCreated();

  const _handleConnectBSIMCard = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      await new Promise((resolve) => setTimeout(resolve));
      await plugins.BSIM.getBSIMVersion();
      await new Promise((resolve) => setTimeout(resolve));
      if (await createVault({ type: 'connectBSIM' })) {
        bottomSheetRef.current?.dismiss();
        setTimeout(() => bottomSheetRef.current?.dismiss(), 25);
        showMessage({
          message: 'Connect BSIM wallet success',
          type: 'success',
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
    await new Promise((resolve) => setTimeout(resolve));
    if (await createVault({ type: 'createNewWallet' })) {
      bottomSheetRef.current?.dismiss();
      setTimeout(() => bottomSheetRef.current?.dismiss(), 25);
      showMessage({
        message: 'Add new wallet success',
        type: 'success',
      });
    }
    navigation.setOptions({ gestureEnabled: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { inAsync: inCreating, execAsync: handleCreateNewHdWallet } = useInAsync(_handleCreateNewHdWallet);

  const _handleImportExistWallet = useCallback(async (value: string) => {
    navigation.setOptions({ gestureEnabled: false });
    await new Promise((resolve) => setTimeout(resolve));
    const res = await createVault({ type: 'importExistWallet', value })
    if (res) {
      bottomSheetRef.current?.dismiss();
      setTimeout(() => bottomSheetRef.current?.dismiss(), 25);
      showMessage({
        message: 'Import wallet success',
        type: 'success',
      });
    } else if (res === undefined) {
      importExistRef.current?.dismiss();
    }
    navigation.setOptions({ gestureEnabled: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { inAsync: inImporting, execAsync: handleImportExistWallet } = useInAsync(_handleImportExistWallet);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints}>
        <View style={styles.container}>
          {!hasBSIMVaultCreated && (
            <Pressable
              style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              disabled={inConnecting}
              onPress={handleConnectBSIMCard}
            >
              {<Image style={accountListStyles.groupTypeImage} source={BSIMCard} />}
              <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Connect BSIM Wallet</Text>
              {inConnecting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            disabled={inCreating}
            onPress={handleCreateNewHdWallet}
          >
            {<Image style={accountListStyles.groupTypeImage} source={BSIMCard} />}
            <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Create new wallet</Text>
            {inCreating && <HourglassLoading style={accountListStyles.addAccountLoading} />}
          </Pressable>

          <Pressable
            style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => importExistRef.current?.present()}
          >
            {<Image style={accountListStyles.groupTypeImage} source={BSIMCard} />}
            <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Import existing wallet</Text>
            {inImporting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
          </Pressable>
        </View>
      </BottomSheet>
      <ImportExistingWallet bottomSheetRef={importExistRef} onSuccessConfirm={handleImportExistWallet} isModal />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const snapPoints = ['30%'];

export default AddAnotherWallet;
