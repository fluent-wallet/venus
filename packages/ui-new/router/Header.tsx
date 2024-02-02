import React from 'react';
import { View, TouchableHighlight, StyleSheet, Text, Platform } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { setMode } from '@hooks/useMode';
import { statusBarHeight, supports3DStructureLight } from '../utils/deviceInfo';

const BackButton: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  if (!navigation.canGoBack()) return null;
  return (
    <TouchableHighlight style={[styles.backButton, { borderColor: colors.borderThird }]} underlayColor={colors.underlay} onPress={() => navigation.goBack()}>
      <ArrowLeft color={colors.iconPrimary} />
    </TouchableHighlight>
  );
};

const Header: React.FC = () => {
  const { mode, colors } = useTheme();

  return (
    <View style={styles.header}>
      <BackButton />
      <TouchableHighlight
        style={[styles.backButton, { borderColor: colors.borderThird, marginLeft: 'auto' }]}
        underlayColor={colors.underlay}
        onPress={() => setMode(mode === 'light' ? 'dark' : 'light')}
      >
        <Text style={{ color: colors.iconPrimary }}>M</Text>
      </TouchableHighlight>
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
