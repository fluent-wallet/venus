import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import clsx from 'clsx';
import { useTheme, Icon } from '@rneui/themed';
import { type Account } from '@core/database/models/Account';
import { useCurrentAddressValueOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';

const AccountAddress: React.FC<{ account: Account; className?: string; nickNameClassName?: string; style?: { opacity: number }; showSelected?: boolean }> = ({
  account,
  className,
  style,
  showSelected,
  nickNameClassName,
}) => {
  const { theme } = useTheme();
  const currentAddressValue = useCurrentAddressValueOfAccount(account.id);

  if (!currentAddressValue) return;
  return (
    <View className={clsx('relative flex flex-col gap-[8px] text-[16px] leading-tight', className)} style={style}>
      <Text className={nickNameClassName} numberOfLines={1} style={{ color: theme.colors.textPrimary }}>
        {account.nickname}
      </Text>
      <Text style={{ color: theme.colors.textSecondary }}>{shortenAddress(currentAddressValue)}</Text>
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
};
export default AccountAddress;
