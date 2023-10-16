import { Dialog } from '@rneui/base';
import { Button, Text, useTheme } from '@rneui/themed';
import { View } from 'react-native';
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
            <View className="flex  items-center mb-7">
              {type === 'error' ? <Warning width={24} height={24} /> : <SuccessIcon width={24} height={24} />}
              <Text className="text-xl font-bold leading-tight  mt-4">{type === 'error' ? 'Error !' : 'Success !'}</Text>
            </View>
          </View>
        </View>
        <Text className="text-sm leading-normal text-center mb-8">{message}</Text>

        <Button>OK</Button>
      </Dialog>
    </View>
  );
}

export default CreatePasswordAlert;
