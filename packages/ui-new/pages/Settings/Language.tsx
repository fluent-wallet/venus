import React, { useCallback, useRef } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { styles as bottomSheetStyle, snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { LanguageStackName, type StackScreenProps } from '@router/configs';
import { styles } from './Appearance';

const Language: React.FC<StackScreenProps<typeof LanguageStackName>> = () => {
  const { colors } = useTheme();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const setLanguage = useCallback((language: Parameters<any>) => {
    // _setMode(mode);
    bottomSheetRef.current?.close();
  }, []);

  return (
    <BottomSheet snapPoints={snapPoints} isRoute containerStyle={bottomSheetStyle.container}>
      <Text style={[bottomSheetStyle.title, { color: colors.textPrimary }]}>Language</Text>

      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        // disabled={mode === 'system'}
        // onPress={() => setMode('system')}
        testID='system'
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>System Language</Text>
        {/* {mode === 'system' && <Checkbox checked pointerEvents="none" />} */}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        // disabled={mode === 'light'}
        // onPress={() => setMode('light')}
        testID='english'
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>English</Text>
        {/* {mode === 'light' && <Checkbox checked pointerEvents="none" />} */}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        // disabled={mode === 'dark'}
        // onPress={() => setMode('dark')}
        testID='traditionalChinese'
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>繁体中文</Text>
        {/* {mode === 'dark' && <Checkbox checked pointerEvents="none" />} */}
      </Pressable>
    </BottomSheet>
  );
};

export default Language;
