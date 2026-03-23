import {
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetRoute,
  BottomSheetWrapper,
  snapPoints as defaultSnapPoints,
  InlineBottomSheet,
} from '@components/BottomSheet';
import { type ComponentProps, useEffect, useImperativeHandle, useRef } from 'react';
import { Keyboard } from 'react-native';

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
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (...args) => bottomSheetRef.current?.snapToIndex(...args),
      snapToPosition: (...args) => bottomSheetRef.current?.snapToPosition(...args),
      expand: (...args) => bottomSheetRef.current?.expand(...args),
      collapse: (...args) => bottomSheetRef.current?.collapse(...args),
      close: (...args) => bottomSheetRef.current?.close(...args),
      forceClose: (...args) => bottomSheetRef.current?.forceClose(...args),
    }),
    [],
  );

  useEffect(() => {
    if (isInlineProps(props)) return;

    const sub = Keyboard.addListener('keyboardDidHide', () => {
      bottomSheetRef.current?.snapToIndex(0);
    });

    return () => sub.remove();
  }, [props.isRoute]);

  if (isInlineProps(props)) {
    const { snapPoints, isRoute: _ignored, index = 0, ...rest } = props;
    return (
      <InlineBottomSheet ref={bottomSheetRef} snapPoints={snapPoints || defaultSnapPoints.large} index={index} {...rest}>
        <BottomSheetWrapper useBottomSheetView={useBottomSheetView}>
          {title && <BottomSheetHeader title={title} />}
          {children}
        </BottomSheetWrapper>
      </InlineBottomSheet>
    );
  }

  const { snapPoints, isRoute: _ignored, index: _index, ...rest } = props;
  return (
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={snapPoints || defaultSnapPoints.percent80} {...rest}>
      <BottomSheetWrapper useBottomSheetView={useBottomSheetView}>
        {title && <BottomSheetHeader title={title} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

export default SendTransactionBottomSheet;
