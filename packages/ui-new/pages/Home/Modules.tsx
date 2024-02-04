import React from 'react';
import { TouchableHighlight, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useCurrentAccount, useCurrentNetwork, useAssetsTotalPriceValue, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';

export const Account: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { colors } = useTheme();
  const account = useCurrentAccount();
  
  return (
    <TouchableHighlight underlayColor={colors.underlay} onPress={onPress}>
      <View style={[styles.accountContainer, { borderColor: colors.borderThird }]}>
        <Text style={[styles.accountText, { color: colors.textPrimary }]}>{account?.nickname ?? 'Loading...'}</Text>
      </View>
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  accountContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 144,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
  },
  accountText: {
    fontSize: 14,
    fontWeight: '300',
  },
});
