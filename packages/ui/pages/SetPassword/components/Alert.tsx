import { View } from 'react-native';
import { Dialog } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import { BaseButton } from '@components/Button';
import SuccessIcon from '@assets/icons/check_circle.svg';
import Warning from '@assets/icons/warning_2.svg';

interface Props {
  show: boolean;
  type: string; //'error' | 'success';
  message: string;
  onCancel?: () => void;
  onOk?: () => void;
}

function CreatePasswordAlert(props: Props) {
  const {
    show,
    type,
    message,
    onOk = () => {
      // do nothing
    },
    onCancel = () => {
      // do nothing
    },
  } = props;
  const {
    theme: { colors },
  } = useTheme();

  if (!show) {
    return null;
  }

  return (
    <View>
      <Dialog isVisible={show} overlayStyle={{ backgroundColor: colors.normalBackground, borderRadius: 8 }}>
        <View className="flex">
          <View className="items-center">
            <View className="flex items-center mb-[28px]">
              {type === 'error' ? <Warning width={24} height={24} /> : <SuccessIcon width={24} height={24} />}
              <Text className="text-xl font-bold leading-tight  mt-4">{type === 'error' ? 'Error !' : 'Success !'}</Text>
            </View>
          </View>
        </View>
        <Text className="text-sm leading-normal text-center mb-8">{message}</Text>

        <BaseButton testID='alertButton' onPress={type === 'error' ? onCancel : onOk}>OK</BaseButton>
      </Dialog>
    </View>
  );
}

export default CreatePasswordAlert;
