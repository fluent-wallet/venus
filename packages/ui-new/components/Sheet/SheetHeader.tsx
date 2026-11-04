import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type { PropsWithChildren, ReactNode } from 'react';
import { Text as NativeText, Pressable, type PressableProps, StyleSheet, useWindowDimensions, View, type ViewProps } from 'react-native';

export function SheetHandle() {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.handle} pointerEvents="none">
      <View style={[styles.indicator, { width: width * 0.075, backgroundColor: palette.gray4 }]} />
    </View>
  );
}

export default function SheetHeader({ title, action, style, children }: PropsWithChildren<{ title: string; action?: ReactNode; style?: ViewProps['style'] }>) {
  const { colors } = useTheme();

  return (
    <View collapsable={false}>
      <SheetHandle />
      <View style={[styles.header, style]}>
        <NativeText style={[styles.title, { color: colors.textPrimary }]}>{title}</NativeText>
        {action}
        {children}
      </View>
    </View>
  );
}

export function SheetHeaderAction({ children, ...props }: PropsWithChildren<Pick<PressableProps, 'onPress' | 'testID' | 'disabled'>>) {
  const { colors } = useTheme();

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.action, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
    >
      <Text style={[styles.title, styles.actionTitle, { color: colors.textPrimary }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    padding: 10,
    alignItems: 'center',
  },
  indicator: {
    height: 4,
    borderRadius: 4,
  },
  header: {
    paddingVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  action: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    top: 12,
    right: 0,
  },
  actionTitle: {
    lineHeight: 20,
  },
});
