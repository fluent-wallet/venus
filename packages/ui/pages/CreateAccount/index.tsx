import { Button, Text, useTheme } from '@rneui/themed';
import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { generateMnemonic } from 'bip39';
import { Vault, createVault } from '@core/DB/models/Vault';
import { AccountGroup, createAccountGroup } from '@core/DB/models/AccountGroup';
import { createAccount } from '@core/DB/service/Account';
import database from '@core/DB';
import TableName from '@core/DB/TableName';
import { cryptoTool } from '@core/DB/helper';

const CreateAccount: React.FC = () => {
  const { theme } = useTheme();

  const createAccountForSeedPhrase = async () => {
    const mnemonic = generateMnemonic();
    console.log(mnemonic)
    const vault = await createVault({
      type: 'hierarchical_deterministic',
      data:mnemonic,
      device: 'ePayWallet',
    });
    // console.log('vault', vault.id, vault);
    // const accountGroup = await createAccountGroup({ vault: vault, nickname: 'My Account', hidden: false });
    // console.log('accountGroup', accountGroup.id, accountGroup);

    // const account = await createAccount({ accountGroup, nickname: 'test-account-1', selected: true });

    // console.log('account', account.id, account);
  };

  return (
    <View className="flex flex-1 relative" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex-1 px-[25px]">
        <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
          <Button onPress={createAccountForSeedPhrase}>New Seed Phrase (dev only)</Button>
        </SafeAreaView>
      </View>
    </View>
  );
};

export default CreateAccount;
