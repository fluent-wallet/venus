import { BottomSheet, type BottomSheetProps } from '@expo/ui';
import { interactiveDismissDisabled, presentationCornerRadius } from '@expo/ui/swift-ui/modifiers';
import { SHEET_CORNER_RADIUS } from './constants';

export type NativeSheetProps = Pick<BottomSheetProps, 'isPresented' | 'onDismiss' | 'containerColor' | 'children'> & {
  dismissible?: boolean;
};

export default function NativeSheet({ dismissible = true, ...props }: NativeSheetProps) {
  return (
    <BottomSheet
      {...props}
      showDragIndicator={false}
      contentPadding={0}
      modifiers={[presentationCornerRadius(SHEET_CORNER_RADIUS), interactiveDismissDisabled(!dismissible)]}
    />
  );
}
