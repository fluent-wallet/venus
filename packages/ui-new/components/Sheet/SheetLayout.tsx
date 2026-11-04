import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps, StyleSheet, View, type ViewProps } from 'react-native';
import SheetHeader from './SheetHeader';

export const SHEET_CONTENT_SPACING = 20;

export const sheetLayoutStyles = StyleSheet.create({
  scrollable: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SHEET_CONTENT_SPACING,
  },
});

type SheetLayoutProps = PropsWithChildren<{
  title: string;
}>;

export default function SheetLayout({ title, children }: SheetLayoutProps) {
  return (
    <View>
      <SheetHeader title={title} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/**
 * In iOS formSheet routes, a direct ScrollView fills the space below its sibling header.
 * For fixed footers, wrap the height-constrained layout in a non-collapsable View so flex controls the list viewport.
 * Keep modal anchors inside the content layout.
 */
export function SheetScrollView({ style, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      {...props}
      style={[sheetLayoutStyles.scrollable, style]}
      contentContainerStyle={[styles.formContent, contentContainerStyle]}
    />
  );
}

export function SheetBody({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.formBody, style]} />;
}

export function SheetFooter({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.formFooter, style]} />;
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: SHEET_CONTENT_SPACING,
  },
  formContent: {
    flexGrow: 1,
  },
  formBody: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  formFooter: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 48,
  },
});
