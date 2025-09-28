import { CommonActions, type NavigationState, type PartialState } from '@react-navigation/native';
import { HomeStackName } from '@router/configs';

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

const findRootNavigation = (navigation: any) => {
  let current = navigation;
  while (current?.getParent?.()) {
    current = current.getParent();
  }
  return current ?? navigation;
};

const backToHome = (navigation: any) => {
  const active = getActiveRouteName(navigation.getState?.());
  if (active === HomeStackName) return;

  const rootNavigation = findRootNavigation(navigation);
  rootNavigation?.dispatch?.(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
};

export default backToHome;
