import React, { type ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import BottomSheet, { snapPoints as defaultSnapPoints } from '@components/BottomSheet';
import Text from '@components/Text';
import { useTranslation } from 'react-i18next';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  showTitle?: boolean;
}

const BackupBottomSheet: React.FC<Props> = ({ children, snapPoints, showTitle = true, ...props }) => {
  const { colors } = useTheme();
  const {t} = useTranslation()

  return (
    <BottomSheet snapPoints={snapPoints || defaultSnapPoints.large} isRoute {...props}>
      <View style={styles.container}>
        {showTitle && <Text style={[styles.title, { color: colors.textPrimary }]}>{t('backup.title')}</Text>}
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

export default BackupBottomSheet;
