import React from 'react';
import { useTheme } from '@rneui/themed';
import { useNetInfo } from '@react-native-community/netinfo';
import CustomMessage from '@components/CustomMessage';
import WifiOffIcon from '@assets/icons/wifi_off.svg';
import { statusBarHeight } from '@utils/deviceInfo';

const NoNetwork: React.FC = () => {
  const { theme } = useTheme();
  const { isConnected } = useNetInfo(); // init state is null

  if (isConnected !== null && !isConnected)
    return (
      <CustomMessage
        className="absolute left-1/2 -translate-x-[182px] top-0 z-10 pointer-events-none"
        style={{ top: statusBarHeight + 48 }}
        message={{ type: 'warning', message: 'No Internet Connection' }}
        icon={{ icon: <WifiOffIcon width={24} height={24} color={theme.colors.textInvert} /> }}
      />
    );
  return null;
};

export default NoNetwork;
