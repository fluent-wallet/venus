import React, { useState, useCallback, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
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
import { screenHeight } from '@utils/deviceInfo';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import createVault from '@pages/InitWallet/createVaultWithRouterParams';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
}

const AddAnotherWallet: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const importExistRef = useRef<BottomSheetMethods>(null!);

  const hasBSIMVaultCreated = useHasBSIMVaultCreated();

  const _handleConnectBSIMCard = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      await new Promise((resolve) => setTimeout(resolve));
      await plugins.BSIM.getBSIMVersion();
      await new Promise((resolve) => setTimeout(resolve));
      if (await createVault({ type: 'connectBSIM' })) {
        setTimeout(() => bottomSheetRef.current?.close(), 25);
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
      setTimeout(() => bottomSheetRef.current?.close(), 25);
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
    await new Promise((resolve) => setTimeout(() => resolve(null!), 20));
    const res = await createVault({ type: 'importExistWallet', value });
    if (res) {
      setTimeout(() => bottomSheetRef.current?.close(), 50);
      showMessage({
        message: 'Import wallet success',
        type: 'success',
      });
    } else if (res === undefined) {
      importExistRef.current?.close();
    }
    navigation.setOptions({ gestureEnabled: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { inAsync: inImporting, execAsync: handleImportExistWallet } = useInAsync(_handleImportExistWallet);
  const [bottomSheetIndex, setBottomSheetIndex] = useState(0);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isRoute onChange={(index) => setBottomSheetIndex(index)} containerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Add Wallet</Text>
        {!hasBSIMVaultCreated && (
          <Pressable
            style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            disabled={inConnecting}
            onPress={handleConnectBSIMCard}
            testID='connectBSIMWallet'
          >
            <Image style={accountListStyles.groupTypeImage} source={BSIMCardWallet} />
            <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Connect BSIM Wallet</Text>
            {inConnecting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          disabled={inCreating}
          onPress={handleCreateNewHdWallet}
          testID='createNewWallet'
        >
          {<Image style={accountListStyles.groupTypeImage} source={HDWallet} />}
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Create new wallet</Text>
          {inCreating && <HourglassLoading style={accountListStyles.addAccountLoading} />}
        </Pressable>

        <Pressable
          style={({ pressed }) => [accountListStyles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          disabled={inCreating}
          onPress={() => importExistRef.current?.expand()}
          testID='importExistWallet'
        >
          {<Image style={accountListStyles.groupTypeImage} source={ExistWallet} />}
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Import existing wallet</Text>
          {inImporting && <HourglassLoading style={accountListStyles.addAccountLoading} />}
        </Pressable>
      </BottomSheet>
      {bottomSheetIndex === 0 && <ImportExistingWallet bottomSheetRef={importExistRef} onSuccessConfirm={handleImportExistWallet} />}
    </>
  );
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginTop: 12,
    marginBottom: 32,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
});

export const snapPoints = [`${((306 / screenHeight) * 100).toFixed(2)}%`];

export default AddAnotherWallet;
