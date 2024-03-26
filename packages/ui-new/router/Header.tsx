import React from 'react';
import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { setMode } from '@hooks/useMode';
import { statusBarHeight, supports3DStructureLight } from '../utils/deviceInfo';

const BackButton: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  if (!navigation.canGoBack()) return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.backButton, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      onPress={() => navigation.goBack()}
    >
      <ArrowLeft color={colors.iconPrimary} />
    </Pressable>
  );
};

const Header: React.FC = () => {
  const { mode, colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.bgPrimary }]}>
      <BackButton />
      <Pressable
        style={({ pressed }) => [
          styles.backButton,
          { borderColor: colors.borderThird, marginLeft: 'auto', backgroundColor: pressed ? colors.underlay : 'transparent' },
        ]}
        onPress={() => setMode(mode === 'light' ? 'dark' : 'light')}
      >
        <Text style={{ color: colors.iconPrimary }}>M</Text>
      </Pressable>
    </View>
  );
};
const styles = StyleSheet.create({
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        height: supports3DStructureLight ? 92 : 72,
      },
      android: {
        height: 56 + statusBarHeight,
      },
    }),
  },
  backButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
  },
});

export default Header;
