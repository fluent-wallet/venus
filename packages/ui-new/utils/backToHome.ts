import { CommonActions, type NavigationState, type PartialState } from '@react-navigation/native';
import { isSamsungDevice } from '@utils/deviceInfo';
import { HomeStackName } from '@router/configs';

function getActiveRouteName(state: NavigationState | PartialState<NavigationState>) {
  if (state.index == null || !state.routes[state.index]) {
    return undefined;
  }

  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

const backToHome = (navigation: any) => {
  // navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
  if (getActiveRouteName(navigation.getState()) === HomeStackName) return;

  if (!isSamsungDevice) {
    navigation.popToTop();
    navigation.goBack();
  } else {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
  }
};

export default backToHome;
