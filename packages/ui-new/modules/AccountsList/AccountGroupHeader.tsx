import Settings from '@assets/icons/settings.svg';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { type IAccountGroup, VaultType } from '@service/core';
import { Image } from 'expo-image';
import type React from 'react';
import { Pressable } from 'react-native';
import { styles } from './styles';

const AccountGroupHeader: React.FC<IAccountGroup & { type: 'selector' | 'management'; onPressGroup?: (groupId: string) => void }> = ({
  id,
  nickname,
  vaultType,
  type,
  onPressGroup,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        styles.group,
        { backgroundColor: pressed ? colors.underlay : type === 'selector' ? colors.bgFourth : colors.bgPrimary },
      ]}
      disabled={type === 'selector' || vaultType === VaultType.PrivateKey || vaultType === VaultType.PublicAddress}
      onPress={() => onPressGroup?.(id)}
      testID="groupSetting"
    >
      <Image
        style={styles.groupTypeImage}
        source={vaultType === VaultType.BSIM ? BSIMCardWallet : vaultType === VaultType.HierarchicalDeterministic ? HDWallet : ExistWallet}
        recyclingKey={vaultType}
      />
      <Text style={[styles.groupName, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
        {vaultType === VaultType.PrivateKey ? 'Imported Private Key' : nickname}
      </Text>
      {type === 'management' && vaultType !== VaultType.PrivateKey && vaultType !== VaultType.PublicAddress && (
        <Settings style={styles.groupSettings} color={colors.textSecondary} />
      )}
    </Pressable>
  );
};

export default AccountGroupHeader;
