import { forwardRef, type ComponentProps } from 'react';
import type BottomSheet from '@components/BottomSheet';
import { BottomSheetWrapper, BottomSheetHeader, snapPoints as defaultSnapPoints, type BottomSheetMethods, BottomSheetRoute } from '@components/BottomSheet';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  title?: string;
}

const SendTransactionBottomSheet = forwardRef<BottomSheetMethods, Props>(({ children, snapPoints, title, ...props }, ref) => {
  return (
    <BottomSheetRoute ref={ref} snapPoints={snapPoints || defaultSnapPoints.large} isRoute {...props}>
      <BottomSheetWrapper>
        {title && <BottomSheetHeader title={title} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
});

export default SendTransactionBottomSheet;
