import React from 'react';
import { View, Text } from 'react-native';
import { BaseButton } from '@components/Button';
import { useTheme } from '@rneui/themed';
import { useCurrentAccount, useCurrentAddressValueOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { type RequestSubject } from '@core/WalletCore/Events/requestSubject';

interface Props {
  requestSubject: RequestSubject;
  handleResolve: () => void;
  handleReject: () => void;
}

const WalletConnectHandler: React.FC<Props> = ({ requestSubject, handleReject, handleResolve }) => {
  const { theme } = useTheme();
  const account = useCurrentAccount();
  const address = useCurrentAddressValueOfAccount(account?.id);

  return (
    <View className="h-[240px] rounded-t-[16px] px-[24px] pt-[12px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
      <Text>
        {requestSubject.request.app.name} ({requestSubject.request.app.origin})
      </Text>

      <Text>连接此站点?</Text>
      <Text>单机连接即表示您允许次去中心化应用查看你的公钥。这是保护您的数据防范网络钓鱼风险的重要安全步骤。</Text>

      {account && address && (
        <Text>
          {account.nickname}
          {address}
        </Text>
      )}

      <View>
        <BaseButton
          testID="reject-wallet-connect"
          onPress={handleReject}
        >
          Cancel
        </BaseButton>
        <BaseButton
          testID="connect-wallet-connec"
          onPress={handleResolve}
        >
          Connect
        </BaseButton>
      </View>
    </View>
  );
};

export default WalletConnectHandler;
