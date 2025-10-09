import { isAdjustResize } from '@utils/deviceInfo';
import { BaseBottomSheet, type BaseBottomSheetProps } from './BaseBottomSheet';

type InlineBottomSheetProps = Omit<BaseBottomSheetProps, 'onAfterClose'> & {
  index?: number;
};

export function InlineBottomSheet({
  showBackDrop = true,
  backDropPressBehavior = 'close',
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableHandlePanningGesture = true,
  keyboardBlurBehavior = 'restore',
  android_keyboardInputMode = isAdjustResize ? 'adjustResize' : 'adjustPan',
  ...rest
}: InlineBottomSheetProps) {
  return (
    <BaseBottomSheet
      showBackDrop={showBackDrop}
      backDropPressBehavior={backDropPressBehavior}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture={enableHandlePanningGesture}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode={android_keyboardInputMode}
      {...rest}
    />
  );
}
