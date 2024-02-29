import BottomSheet, { snapPoints } from '@components/BottomSheet';
import { useTheme } from '@react-navigation/native';
import { Text, View, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
}

const BackupBottomSheet: React.FC<Props> = ({ children, onClose }) => {
  const { colors } = useTheme();
  return (
    <BottomSheet snapPoints={snapPoints.large} index={0} isModal={false} onClose={onClose}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Back Up</Text>
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
