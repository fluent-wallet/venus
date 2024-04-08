import React, { useCallback, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import NetworksList from '@modules/NetworksList';
import Text from '@components/Text';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
export { type BottomSheetMethods };

interface Props {
  onClose: () => void;
}

const NetworkSelector: React.FC<Props> = ({ onClose }) => {
  const { colors } = useTheme();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const handleSelect = useCallback(() => {
    bottomSheetRef?.current?.close();
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.percent75} index={0} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Network</Text>
          <Pressable testID='edit' style={({ pressed }) => [styles.edit, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>⚙️ Edit</Text>
          </Pressable>
        </View>
        <NetworksList type="selector" onSelect={handleSelect} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  edit: {
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    top: 0,
    right: 0,
  },
});

export default NetworkSelector;
