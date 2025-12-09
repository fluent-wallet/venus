import { CommonActions, type NavigationProp, type NavigationState, type PartialState, StackActions } from '@react-navigation/native';
import { HomeStackName, type RootStackParamList } from '@router/configs';

export function getActiveRouteName(state: NavigationState | PartialState<NavigationState>) {
  if (state.index == null || !state.routes[state.index]) {
    return undefined;
  }

  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

const findRootNavigation = (navigation: NavigationProp<RootStackParamList>) => {
  let current = navigation;
  while (current?.getParent?.()) current = current.getParent();
  return current ?? navigation;
};

const backToHome = (navigation: NavigationProp<RootStackParamList>) => {
  const rootNavigation = findRootNavigation(navigation);
  const state = rootNavigation.getState?.();
  if (!state || getActiveRouteName(state) === HomeStackName) return;

  const homeIndex = state.routes.findIndex((route) => route.name === HomeStackName);
  if (homeIndex === -1) {
    rootNavigation.dispatch(CommonActions.navigate({ name: HomeStackName }));
    return;
  }

  const pops = state.index - homeIndex;
  if (pops > 0) {
    rootNavigation.dispatch(StackActions.pop(pops));
  } else if (state.routes[state.index]?.name !== HomeStackName) {
    rootNavigation.dispatch(CommonActions.navigate({ name: HomeStackName }));
  }
};

export default backToHome;
