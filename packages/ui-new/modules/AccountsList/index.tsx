import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAccountsManage } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';

const AccountsList: React.FC = () => {
  const accountsManage = useAccountsManage();
  
  return (
    <FlashList
      data={accountsManage}
      renderItem={({ item }) => {
        if ('vaultType' in item) {
          return (
            <View style={styles.row}>
              <Text>{item.nickname}</Text>
            </View>
          );
        } else {
          return (
            <View style={styles.row}>
              <View>
                <Text>{item.nickname}</Text>
                <Text>{item.addressValue}</Text>
              </View>
            </View>
          );
        }
      }}
      getItemType={(item) => ('vaultType' in item ? 'sectionHeader' : 'row')}
      estimatedItemSize={50}
    />
  );
};

const styles = StyleSheet.create({
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: 50,
  },
});

export default AccountsList;
