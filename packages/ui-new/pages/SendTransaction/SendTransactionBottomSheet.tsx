import BottomSheet, { snapPoints as defaultSnapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { type ComponentProps, forwardRef } from 'react';
import { StyleSheet } from 'react-native';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  showTitle?: boolean | string;
}

const SendTransactionBottomSheet = forwardRef<BottomSheetMethods, Props>(({ children, snapPoints, showTitle = true, ...props }, ref) => {
  const { colors } = useTheme();

  return (
    <BottomSheet ref={ref} snapPoints={snapPoints || defaultSnapPoints.large} isRoute style={styles.container} {...props}>
      {showTitle && <Text style={[styles.title, { color: colors.textPrimary }]}>{typeof showTitle === 'string' ? showTitle : 'Send To'}</Text>}
      {children}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginTop: 8,
    marginBottom: 0,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SendTransactionBottomSheet;
