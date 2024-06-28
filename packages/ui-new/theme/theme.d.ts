import '@react-navigation/native';
import type { CustomTheme } from './';

declare module '@react-navigation/native' {
  export function useTheme(): CustomTheme;
}
