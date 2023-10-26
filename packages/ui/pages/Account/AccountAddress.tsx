import { View, Text } from 'react-native';
import { useTheme } from '@rneui/themed';
import { shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { type Account } from '@DB/models/Account';
import { type Address } from '@DB/models/Address';
import { withObservables } from '@DB/react';

const AccountAddress: React.FC<{ account: Account }> = withObservables(['account'], ({ account }: { account: Account }) => ({
  account: account.observe(),
  address: account.address.observe(),
}))(({ account, address }: { account: Account; address: Address[] }) => {
  const { theme } = useTheme();
  const _address = address?.[0];

  if (!_address) return;
  return (
    <View className="flex flex-row text-[16px] leading-tight">
      <Text style={{ color: theme.colors.textPrimary }}>{account.nickname}</Text>
      <Text style={{ color: theme.colors.textSecondary }}>{shortenAddress(_address.hex)}</Text>
    </View>
  );
});

export default AccountAddress;
