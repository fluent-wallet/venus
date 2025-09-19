import { isAdjustResize } from '@utils/deviceInfo';
import { BaseBottomSheet, type BaseBottomSheetProps } from './BaseBottomSheet';

type InlineBottomSheetProps = Omit<BaseBottomSheetProps, 'controlledIndex' | 'defaultIndex' | 'onAfterClose'> & {
  index?: number;
};

export function InlineBottomSheet({
  ref,
  index,
  showBackDrop = true,
  backDropPressBehavior = 'close',
  handlePressBackdrop,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableHandlePanningGesture = true,
  keyboardBlurBehavior = 'restore',
  android_keyboardInputMode = isAdjustResize ? 'adjustResize' : 'adjustPan',
  ...rest
}: InlineBottomSheetProps) {
  return (
    <BaseBottomSheet
      ref={ref}
      controlledIndex={typeof index === 'number' ? index : undefined}
      defaultIndex={-1}
      showBackDrop={showBackDrop}
      backDropPressBehavior={backDropPressBehavior}
      handlePressBackdrop={handlePressBackdrop}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture={enableHandlePanningGesture}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode={android_keyboardInputMode}
      {...rest}
    />
  );
}
