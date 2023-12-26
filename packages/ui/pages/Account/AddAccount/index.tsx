import React, { useState } from 'react';
import { SafeAreaView, TouchableOpacity, TouchableHighlight, ActivityIndicator } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useTheme, ListItem } from '@rneui/themed';
import { useHasBSIMVaultCreated } from '@core/WalletCore/Plugins/ReactInject';
import useInAsync from '@hooks/useInAsync';
import { type RootStackList, type StackNavigation, ImportWalletStackName, AddAccountStackName } from '@router/configs';
import createVaultWithRouterParams from '@pages/SetPassword/createVaultWithRouterParams';

const AddAccount: React.FC<{ navigation: StackNavigation }> = ({ navigation }: { navigation: StackNavigation }) => {
  const route = useRoute<RouteProp<RootStackList, typeof AddAccountStackName>>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const hasBSIMVaultCreated = useHasBSIMVaultCreated();
  const [createType, setCreateType] = useState<'BSIM' | 'NewHD' | null>(null);
  const { inAsync: inCreateVault, execAsync: createVault } = useInAsync(createVaultWithRouterParams);

  return (
    <SafeAreaView className="flex-1 flex flex-col gap-[12px] px-[24px]" style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 16 }}>
      {!hasBSIMVaultCreated && (
        <TouchableHighlight
          testID="createBSIMWallet"
          className="rounded-[8px] overflow-hidden"
          onPress={async () => {
            setCreateType('BSIM');
            await createVault({ type: 'BSIM' });
            navigation.goBack();
          }}
          disabled={inCreateVault}
        >
          <ListItem>
            <ListItem.Content>
              <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
                BSIM Wallet
              </ListItem.Title>
            </ListItem.Content>
            {inCreateVault && createType === 'BSIM' && <ActivityIndicator color={theme.colors.surfaceBrand} />}
          </ListItem>
        </TouchableHighlight>
      )}

      <TouchableHighlight
        testID="createHDWallet"
        className="rounded-[8px] overflow-hidden"
        onPress={async () => {
          setCreateType('NewHD');
          await createVault();
          navigation.goBack();
        }}
        disabled={inCreateVault}
      >
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              New Seed Phrase
            </ListItem.Title>
          </ListItem.Content>
          {inCreateVault && createType === 'NewHD' && <ActivityIndicator color={theme.colors.surfaceBrand} />}
        </ListItem>
      </TouchableHighlight>

      <TouchableHighlight
        testID="importSeedPhrase"
        className="rounded-[8px] overflow-hidden"
        onPress={() => navigation.navigate(ImportWalletStackName, route.params)}
        disabled={inCreateVault}
      >
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              Import Seed Phrase
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </TouchableHighlight>

      <TouchableOpacity
        testID="importPrivateKey"
        className="rounded-[8px] overflow-hidden"
        onPress={() => navigation.navigate(ImportWalletStackName, route.params)}
        disabled={inCreateVault}
      >
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              Import Private Key
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default AddAccount;
