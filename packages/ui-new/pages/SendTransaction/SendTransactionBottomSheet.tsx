import { forwardRef, type ComponentProps } from 'react';

import {
  BottomSheetWrapper,
  BottomSheetHeader,
  snapPoints as defaultSnapPoints,
  type BottomSheetMethods,
  BottomSheetRoute,
  InlineBottomSheet,
} from '@components/BottomSheet';

type RouteProps = {
  isRoute?: true;
} & ComponentProps<typeof BottomSheetRoute>;

type InlineProps = {
  isRoute: false;
} & ComponentProps<typeof InlineBottomSheet>;

type Props = (RouteProps | InlineProps) & {
  ref?: React.Ref<BottomSheetMethods>;
  children: React.ReactNode;
  title?: string;
  index?: number;
  useBottomSheetView?: boolean;
};

const isInlineProps = (props: Props): props is InlineProps => {
  return props.isRoute === false;
};

const SendTransactionBottomSheet = ({ ref, useBottomSheetView = true, ...props }: Props) => {
  const { children, title } = props;

  if (isInlineProps(props)) {
    const { snapPoints, isRoute: _ignored, index = 0, ...rest } = props;
    return (
      <InlineBottomSheet ref={ref} snapPoints={snapPoints || defaultSnapPoints.large} index={index} {...rest}>
        <BottomSheetWrapper useBottomSheetView={useBottomSheetView}>
          {title && <BottomSheetHeader title={title} />}
          {children}
        </BottomSheetWrapper>
      </InlineBottomSheet>
    );
  }

  const { snapPoints, isRoute: _ignored, index: _index, ...rest } = props;
  return (
    <BottomSheetRoute ref={ref} snapPoints={snapPoints || defaultSnapPoints.percent80} {...rest}>
      <BottomSheetWrapper useBottomSheetView={useBottomSheetView}>
        {title && <BottomSheetHeader title={title} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

export default SendTransactionBottomSheet;
