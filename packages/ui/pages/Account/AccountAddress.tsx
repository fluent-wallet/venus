import { useMemo } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, Icon } from '@rneui/themed';
import cx from 'clsx';
import { shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { type Account } from '@DB/models/Account';
import { type Address } from '@DB/models/Address';
import { withObservables } from '@DB/react';

const AccountAddress: React.FC<{ account: Account; className?: string; style?: { opacity: number }; showSelected?: boolean }> = withObservables(
  ['account'],
  ({ account }: { account: Account }) => ({
    account: account.observe(),
    currentNetworkAddress: account.currentNetworkAddress,
  })
)(
  ({
    account,
    currentNetworkAddress,
    className,
    style,
    showSelected,
  }: {
    account: Account;
    currentNetworkAddress: Address;
    className?: string;
    style?: { opacity: number };
    showSelected?: boolean;
  }) => {
    const { theme } = useTheme();
    const shortAddress = useMemo(() => shortenAddress(currentNetworkAddress?.hex), [currentNetworkAddress]);

    if (!currentNetworkAddress) return;
    return (
      <View className={cx('relative text-[16px] leading-tight pointer-events-none', className)}>
        <Text style={{ color: theme.colors.textPrimary }}>{account.nickname}</Text>
        <Text className="mt-[8px]" style={{ color: theme.colors.textSecondary }}>
          {shortAddress}
        </Text>
        {showSelected && account.selected && (
          <View
            className="absolute top-1/2 -translate-y-[12px] right-[0px] w-[24px] h-[24px] rounded-full flex justify-center items-center"
            style={{ backgroundColor: theme.colors.surfaceBrand }}
          >
            <Icon name="done" color={theme.colors.surfaceCard} size={18} />
          </View>
        )}
      </View>
    );
  }
);

export default AccountAddress;
