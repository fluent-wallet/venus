import { RNHostView } from '@expo/ui';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NativeSheet, { type NativeSheetProps } from './NativeSheet';
import { resolveSheetHeight, type SheetHeight } from './sizing';

type SheetProps = NativeSheetProps & {
  /** Fixed content height. 'large' uses the shared app rule; when omitted, the sheet fits its content. */
  height?: SheetHeight;
  /** Maximum content height, including the header and footer. Fractions use the window height excluding safe areas; height is in dp. */
  maxHeight?: SheetHeight;
};

export default function Sheet({ height, maxHeight, children, ...props }: SheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(0, windowHeight - insets.top - insets.bottom);
  const dimensions = { windowHeight, availableHeight };
  const contentHeight = resolveSheetHeight(height, dimensions);
  const contentMaxHeight = resolveSheetHeight(maxHeight, dimensions) ?? availableHeight;

  return (
    <NativeSheet {...props}>
      <RNHostView matchContents={{ vertical: true }}>
        <View style={{ height: contentHeight, maxHeight: contentMaxHeight }}>{children}</View>
      </RNHostView>
    </NativeSheet>
  );
}
