import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type { StackScreenProps, TransactionDetailStackName } from '@router/configs';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

const TransactionDetail: React.FC<StackScreenProps<typeof TransactionDetailStackName>> = ({ route }) => {
  const { txId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text>{txId}</Text>
    </View>
  );
};

export const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingHorizontal: 16,
    flex: 1,
  },
});

export default TransactionDetail;
