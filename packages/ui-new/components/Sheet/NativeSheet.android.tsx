import { Host, ModalBottomSheet, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeSheetProps } from './NativeSheet';

// Use the Android primitive to set skipPartiallyExpanded, which the universal BottomSheet does not expose.
export default function NativeSheet({ isPresented, onDismiss, containerColor, children, dismissible = true }: NativeSheetProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const isClosing = useRef(false);
  const [isMounted, setIsMounted] = useState(isPresented);

  useEffect(() => {
    if (isPresented) {
      setIsMounted(true);
      if (isClosing.current) {
        isClosing.current = false;
        sheetRef.current?.expand();
      }
      return;
    }

    const sheet = sheetRef.current;
    if (!sheet) return;

    isClosing.current = true;
    let cancelled = false;
    sheet.hide().then(() => {
      if (!cancelled) {
        isClosing.current = false;
        setIsMounted(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isPresented]);

  if (!isMounted) return null;

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="none">
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onDismiss}
        containerColor={containerColor}
        showDragHandle={false}
        skipPartiallyExpanded
        sheetGesturesEnabled={dismissible}
        properties={{ shouldDismissOnBackPress: dismissible, shouldDismissOnClickOutside: dismissible }}
      >
        {children}
      </ModalBottomSheet>
    </Host>
  );
}
