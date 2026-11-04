import { SheetHeader, SheetHeaderAction, sheetLayoutStyles } from '@components/Sheet';
import { AccountManagementStackName, type AccountSelectorStackName, type StackScreenProps } from '@router/configs';
import { useSwitchAccount } from '@service/account';
import { useAccountSections } from '@service/accountSections';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import AccountSelectorList from './AccountSelectorList';

const AccountSelector: React.FC<StackScreenProps<typeof AccountSelectorStackName>> = ({ navigation }) => {
  const { t } = useTranslation();
  const switchAccount = useSwitchAccount();
  const { sections, currentAccountId } = useAccountSections();
  const handleSelectAccount = useCallback(
    (accountId: string) => {
      switchAccount(accountId);
      navigation.goBack();
    },
    [switchAccount, navigation],
  );

  return (
    <View collapsable={false} style={sheetLayoutStyles.scrollable}>
      <SheetHeader
        title={t('common.account')}
        action={
          <SheetHeaderAction testID="edit" onPress={() => navigation.navigate(AccountManagementStackName, { fromAccountSelector: true })}>
            {t('common.edit')}
          </SheetHeaderAction>
        }
      />
      <AccountSelectorList sections={sections} currentAccountId={currentAccountId} onSelectAccount={handleSelectAccount} />
    </View>
  );
};

export default AccountSelector;
