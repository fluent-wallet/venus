import React from 'react';
import { SafeAreaView, TouchableOpacity, TouchableHighlight, ActivityIndicator } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useTheme, ListItem } from '@rneui/themed';
import { ImportWalletStackName, type RootStackList, type StackNavigation } from '@router/configs';
import useInAsync from '@hooks/useInAsync';
import { createHDVault as _createHDVault } from '@core/DB/models/Vault/service';

export const AddAccountStackName = 'AddNewAccount';

const AddAccount: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RootStackList, typeof AddAccountStackName>>();
  const { inAsync: inCreateHDVault, execAsync: createHDVault } = useInAsync(_createHDVault);

  return (
    <SafeAreaView className="flex-1 flex flex-col gap-[12px] px-[24px]" style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 16 }}>
      <TouchableHighlight
        className="rounded-[8px] overflow-hidden"
        onPress={async () => {
          await createHDVault();
          navigation.goBack();
        }}
        disabled={inCreateHDVault}
      >
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              New Seed Phrase
            </ListItem.Title>
          </ListItem.Content>
          {inCreateHDVault && <ActivityIndicator color={theme.colors.surfaceBrand} />}
        </ListItem>
      </TouchableHighlight>

      <TouchableHighlight className="rounded-[8px] overflow-hidden" onPress={() => navigation.navigate(ImportWalletStackName, route.params)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              Import Seed Phrase
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </TouchableHighlight>

      <TouchableOpacity className="rounded-[8px] overflow-hidden" onPress={() => navigation.navigate(ImportWalletStackName, route.params)}>
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
