import { clamp } from 'lodash-es';

export type SheetHeight = 'large' | { fraction: number; height?: never } | { height: number; fraction?: never };

export function resolveSheetHeight(value: SheetHeight | undefined, { windowHeight, availableHeight }: { windowHeight: number; availableHeight: number }) {
  if (value === undefined) return undefined;
  const requestedHeight =
    value === 'large' ? getLargeSheetHeight(windowHeight) : value.fraction !== undefined ? value.fraction * availableHeight : value.height;
  return Math.min(availableHeight, Math.max(0, requestedHeight));
}

// Preserve the app's established large-sheet height.
export function getLargeSheetHeight(windowHeight: number) {
  return Math.round(clamp(windowHeight - 100, 628, windowHeight - 40));
}
