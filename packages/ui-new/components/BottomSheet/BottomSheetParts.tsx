import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '@react-navigation/native';
import { screenHeight } from '@utils/deviceInfo';
import { clamp } from 'lodash-es';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type WithInnerPadding<T extends React.ComponentType<any>> = {
  innerPaddingHorizontal?: boolean;
} & Omit<ComponentProps<T>, 'children'> & {
    children?: ComponentProps<T>['children'];
  };
type WrapperProps = WithInnerPadding<typeof BottomSheetView> & { useBottomSheetView?: boolean };
type SectionProps = WithInnerPadding<typeof View>;
type ScrollSectionProps = WithInnerPadding<typeof BottomSheetScrollView>;
export const BottomSheetWrapper = ({
  children,
  innerPaddingHorizontal = false,
  style,
  useBottomSheetView = false,
  ...props
}: WrapperProps & { useBottomSheetView?: boolean }) => {
  const Container = useBottomSheetView ? BottomSheetView : View;
  return (
    <Container style={[styles.wrapper, innerPaddingHorizontal && styles.paddingH16, style]} {...props}>
      {children}
    </Container>
  );
};

export const BottomSheetHeader = ({ children, title, innerPaddingHorizontal = false, style, ...props }: SectionProps & { title?: string }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.headerWrapper, innerPaddingHorizontal && styles.paddingH16, style]} {...props}>
      {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
      {children}
    </View>
  );
};

export const BottomSheetContent = ({ children, innerPaddingHorizontal = false, style, ...props }: SectionProps) => (
  <View style={[styles.contentWrapper, innerPaddingHorizontal && styles.paddingH16, style]} {...props}>
    {children}
  </View>
);

export const BottomSheetFooter = ({ children, innerPaddingHorizontal = false, style, ...props }: SectionProps) => (
  <View style={[styles.footerWrapper, innerPaddingHorizontal && styles.paddingH16, style]} {...props}>
    {children}
  </View>
);

export const BottomSheetScrollContent = ({ children, innerPaddingHorizontal = false, style, ...props }: ScrollSectionProps) => (
  <BottomSheetScrollView style={[styles.scrollContentWrapper, innerPaddingHorizontal && styles.paddingH16, style]} {...props}>
    {children}
  </BottomSheetScrollView>
);
export const snapPoints = {
  large: [`${((clamp(screenHeight - 100, 628, screenHeight - 40) / screenHeight) * 100).toFixed(2)}%`] as string[],
  percent75: ['75%'] as string[],
  percent65: ['65%'] as string[],
  percent55: ['55%'] as string[],
  percent50: ['50%'] as string[],
  percent45: ['45%'] as string[],
  percent40: ['40%'] as string[],
  percent35: ['35%'] as string[],
  percent30: ['30%'] as string[],
  percent25: ['25%'] as string[],
} as const;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    maxHeight: '100%',
  },
  headerWrapper: {
    flex: 0,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  scrollContentWrapper: {
    flex: 1,
  },
  footerWrapper: {
    flex: 0,
    marginTop: 16,
    marginBottom: 48,
  },
  paddingH16: {
    paddingHorizontal: 16,
  },
});
