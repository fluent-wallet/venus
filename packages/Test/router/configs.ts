import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';

export const AStackName = 'A';
export const BStackName = 'B';
export const CStackName = 'C';
export const HomeStackName = 'Home';
export type RootStackParamList = {
  [AStackName]: undefined;
  [BStackName]: undefined;
  [CStackName]: undefined;

  [HomeStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
export type StackNavigation = NavigationProp<RootStackParamList>;

// SheetBottomOption
export const SheetBottomOption = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  safeAreaInsets: {top: 0},
  animation: 'fade' as const,
};
