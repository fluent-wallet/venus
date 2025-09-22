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
};

const isInlineProps = (props: Props): props is InlineProps => {
  return props.isRoute === false;
};

const SendTransactionBottomSheet = ({ ref, ...props }: Props) => {
  const { children, title } = props;

  if (isInlineProps(props)) {
    const { snapPoints, isRoute: _ignored, ...rest } = props;
    return (
      <InlineBottomSheet ref={ref} snapPoints={snapPoints || defaultSnapPoints.large} {...rest}>
        <BottomSheetWrapper>
          {title && <BottomSheetHeader title={title} />}
          {children}
        </BottomSheetWrapper>
      </InlineBottomSheet>
    );
  }

  const { snapPoints, isRoute: _ignored, index: _index, ...rest } = props;
  return (
    <BottomSheetRoute ref={ref} snapPoints={snapPoints || defaultSnapPoints.large} {...rest}>
      <BottomSheetWrapper>
        {title && <BottomSheetHeader title={title} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

export default SendTransactionBottomSheet;
