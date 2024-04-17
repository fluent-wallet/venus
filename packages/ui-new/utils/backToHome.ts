import { CommonActions, StackActions } from '@react-navigation/native';
import { isSamsungDevice } from '@utils/deviceInfo';
import { HomeStackName } from '@router/configs';

const backToHome = (navigation: any) => {
  // navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
  if (!isSamsungDevice) {
    navigation.popToTop();
    navigation.goBack();
  } else {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
  }
};

export default backToHome;
