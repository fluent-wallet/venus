import Text from '@components/Text';
import type { AssetTypeValue } from '@core/types';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { StyleSheet } from 'react-native';

const AssetTypeLabel: React.FC<{ assetType: AssetTypeValue }> = ({ assetType }) => {
  const { colors } = useTheme();

  return <Text style={[styles.label, { backgroundColor: colors.up, color: colors.textSecondary }]}>{assetType}</Text>;
};

const styles = StyleSheet.create({
  label: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '300',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    height: '100%',
    borderRadius: 4,
  },
});

export default AssetTypeLabel;
