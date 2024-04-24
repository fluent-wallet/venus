import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AssetType } from '@core/database/models/Asset';
import Text from '@components/Text';

const AssetTypeLabel: React.FC<{ assetType: AssetType }> = ({ assetType }) => {
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
