import ArrowLeft from '@assets/icons/arrow-left.svg';
import { useNavigation, useTheme } from '@react-navigation/native';
import type React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { statusBarHeight, supports3DStructureLight } from '../utils/deviceInfo';
import Text from '@components/Text';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

const BackButton: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  if (!navigation.canGoBack()) return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.backButton, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      onPress={() => navigation.goBack()}
      testID="backButton"
    >
      <ArrowLeft color={colors.iconPrimary} />
    </Pressable>
  );
};

const Header: React.FC<NativeStackHeaderProps> = (props) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.bgPrimary }]}>
      <BackButton />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{props.options?.title}</Text>
    </View>
  );
};
const styles = StyleSheet.create({
  header: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        height: supports3DStructureLight ? 92 : 72,
      },
      android: {
        height: 56 + statusBarHeight,
      },
    }),
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 40,
  },
  backButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    position: 'absolute',
    left: 16,
  },
});

export default Header;
