import { Button, Text } from '@rneui/themed';
import { View, ImageBackground, useColorScheme, ActivityIndicator } from 'react-native';
import BSIMSendBGDarkImage from '@assets/images/BSIMSendDark.webp';
import BSIMSendBGLightImage from '@assets/images/BSIMSendLight.webp';
import CloseIcon from '@assets/icons/close.svg';

import { useNavigation } from '@react-navigation/native';
import { BaseButton } from '@components/Button';
import WaringIcon from '@assets/icons/warning_2.svg';
import CheckCircleIcon from '@assets/icons/check_circle.svg';
import { HomeStackName, StackNavigation, WalletStackName } from '@router/configs';

export enum BSIM_SIGN_STATUS {
  NOT_HAVE_BSIM = 'NOT_HAVE_BSIM',
  INIT = 'INIT',
  SIGNING = 'SIGNING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export const STATUS_VALUES: Record<
  BSIM_SIGN_STATUS,
  {
    title: string;
    titleIcon?: () => React.ReactNode;
    context: string;
    showButton?: boolean;
    buttonContext?: string;
    showCloseIcon?: boolean;
  }
> = {
  [BSIM_SIGN_STATUS.NOT_HAVE_BSIM]: {
    title: 'Sign using BSIM card',
    context: 'The BSIM page will be call up, enter your BPIN code to continue.',
    showButton: true,
    buttonContext: 'Please insert BSIM card',
    showCloseIcon: true,
  },
  [BSIM_SIGN_STATUS.INIT]: {
    title: 'Sign using BSIM card',
    context: 'The BSIM page will be call up, enter your BPIN code to continue.',
    showButton: true,
    buttonContext: 'Begin signing process',
    showCloseIcon: true,
  },
  [BSIM_SIGN_STATUS.SIGNING]: {
    title: 'Transaction Confirmation',
    titleIcon: () => <ActivityIndicator className="w-6 h-6" color={'#4572EC'} />,
    context: 'Communicating with BSIM Card...',
    showButton: false,
    buttonContext: 'Begin signing process',
    showCloseIcon: false,
  },
  [BSIM_SIGN_STATUS.COMPLETE]: {
    title: 'Transaction Submitted',
    titleIcon: () => <CheckCircleIcon width={24} height={24} />,
    context: 'BSIM Card is signing',
    showButton: true,
    buttonContext: 'OK',
    showCloseIcon: false,
  },
  [BSIM_SIGN_STATUS.ERROR]: {
    title: 'Transaction Failed',
    titleIcon: () => <WaringIcon width={24} height={24} />,
    showButton: true,
    buttonContext: 'Retry',
    context: '',
    showCloseIcon: true,
  },
};
interface Props {
  onSend: () => void;
  state: BSIM_SIGN_STATUS;
  errorMessage?: string;
}

const BSIMSendTX: React.FC<Props> = ({ onSend, state, errorMessage }) => {
  const navigation = useNavigation<StackNavigation>();
  const model = useColorScheme();
  const { title, titleIcon: TitleIcon, context, showButton, buttonContext, showCloseIcon } = STATUS_VALUES[state];
  return (
    <View className="flex-1 rounded-t-lg overflow-hidden shadow-2xl">
      <ImageBackground resizeMode="stretch" className="flex-1 p-6 " source={model === 'dark' ? BSIMSendBGDarkImage : BSIMSendBGLightImage}>
        <View className="flex flex-row items-center mt-4 ">
          <Text className="text-xl font-bold leading-tight">{title}</Text>
          {TitleIcon && (
            <View className="ml-2">
              <TitleIcon />
            </View>
          )}
        </View>
        <Text className="text-sm leading-normal py-5">{context || errorMessage}</Text>
        <View className="flex flex-row mt-auto">
          {showCloseIcon && (
            <Button
              type="outline"
              buttonStyle={{ width: 48, height: 48, borderRadius: 40, marginRight: 15 }}
              onPress={() => navigation.navigate(HomeStackName, { screen: WalletStackName })}
            >
              <CloseIcon />
            </Button>
          )}
          {showButton && (
            <View className="flex-1">
              <BaseButton disabled={state === BSIM_SIGN_STATUS.NOT_HAVE_BSIM} onPress={onSend}>
                {buttonContext}
              </BaseButton>
            </View>
          )}
        </View>
      </ImageBackground>
    </View>
  );
};

export default BSIMSendTX;
