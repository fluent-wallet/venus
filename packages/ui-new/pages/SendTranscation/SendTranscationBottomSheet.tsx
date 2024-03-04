import React, { type ComponentProps } from 'react';
import { useTheme } from '@react-navigation/native';
import { Text, View, StyleSheet } from 'react-native';
import BottomSheet, { snapPoints as defaultSnapPoints } from '@components/BottomSheet';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  showTitle?: boolean;
}

const SendTranscationBottomSheet: React.FC<Props> = ({ children, snapPoints, showTitle = true, ...props }) => {
  const { colors } = useTheme();

  return (
    <BottomSheet snapPoints={snapPoints || defaultSnapPoints.large} index={0} isModal={false} {...props}>
      <View style={styles.container}>
        {showTitle && <Text style={[styles.title, { color: colors.textPrimary }]}>Send To</Text>}
        {children}
      </View>
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

export default SendTranscationBottomSheet;
