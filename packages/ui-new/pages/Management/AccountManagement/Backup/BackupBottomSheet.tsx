import React, { type ComponentProps } from 'react';
import { useTheme } from '@react-navigation/native';
import { Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView, snapPoints as defaultSnapPoints } from '@components/BottomSheetNew';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  showTitle?: boolean;
}

const BackupBottomSheet: React.FC<Props> = ({ children, snapPoints, showTitle = true, ...props }) => {
  const { colors } = useTheme();

  return (
    <BottomSheet snapPoints={snapPoints || defaultSnapPoints.large} isRoute {...props}>
      <BottomSheetView style={styles.container}>
        {showTitle && <Text style={[styles.title, { color: colors.textPrimary }]}>Back Up</Text>}
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    marginBottom: 0,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BackupBottomSheet;
