import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@rneui/themed';
import cx from 'clsx';
import { shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { type Account } from '@DB/models/Account';
import { type Address } from '@DB/models/Address';
import { withObservables } from '@DB/react';

const AccountAddress: React.FC<{ account: Account; className?: string; style?: StyleProp<ViewStyle> }> = withObservables(['account'], ({ account }: { account: Account }) => ({
  account: account.observe(),
  address: account.address.observe(),
}))(({ account, address, className, style }: { account: Account; address: Address[]; className?: string; style?: StyleProp<ViewStyle> }) => {
  const { theme } = useTheme();
  const _address = address?.[0];

  if (!_address) return;
  return (
    <View className={cx("flex flex-col text-[16px] leading-tight", className)} style={style}>
      <Text style={{ color: theme.colors.textPrimary }}>{account.nickname}</Text>
      <Text className='mt-[8px]' style={{ color: theme.colors.textSecondary }}>{shortenAddress(_address.hex)}</Text>
    </View>
  );
});

export default AccountAddress;
