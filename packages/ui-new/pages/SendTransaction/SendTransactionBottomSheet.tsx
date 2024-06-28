import { forwardRef, type ComponentProps } from 'react';
import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, snapPoints as defaultSnapPoints, type BottomSheetMethods } from '@components/BottomSheet';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  title?: string;
}

const SendTransactionBottomSheet = forwardRef<BottomSheetMethods, Props>(({ children, snapPoints, title, ...props }, ref) => {
  return (
    <BottomSheet ref={ref} snapPoints={snapPoints || defaultSnapPoints.large} isRoute {...props}>
      <BottomSheetWrapper>
        {title && <BottomSheetHeader title={title} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheet>
  );
});

export default SendTransactionBottomSheet;
