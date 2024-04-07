import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { styles as bottomSheetStyle, snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { AppearanceStackName, type StackScreenProps } from '@router/configs';
import { setMode as _setMode, useMode } from '@hooks/useMode';

const Appearance: React.FC<StackScreenProps<typeof AppearanceStackName>> = () => {
  const { colors } = useTheme();
  const mode = useMode();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const setMode = useCallback((mode: Parameters<typeof _setMode>[0]) => {
    _setMode(mode);
    bottomSheetRef.current?.close();
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isRoute containerStyle={bottomSheetStyle.container}>
      <Text style={[bottomSheetStyle.title, { color: colors.textPrimary }]}>Appearance</Text>

      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        disabled={mode === 'system'}
        onPress={() => setMode('system')}
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>System</Text>
        {mode === 'system' && <Checkbox checked pointerEvents="none" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        disabled={mode === 'light'}
        onPress={() => setMode('light')}
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>Light</Text>
        {mode === 'light' && <Checkbox checked pointerEvents="none" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        disabled={mode === 'dark'}
        onPress={() => setMode('dark')}
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>Dark</Text>
        {mode === 'dark' && <Checkbox checked pointerEvents="none" />}
      </Pressable>
    </BottomSheet>
  );
};

export const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
});

export default Appearance;
