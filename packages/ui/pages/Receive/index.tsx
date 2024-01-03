import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@rneui/base';
import { Divider, Text, useTheme } from '@rneui/themed';
import { useCurrentAccount, useCurrentAddress, useCurrentAddressValue, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { statusBarHeight } from '@utils/deviceInfo';
import { type RootStackList, SetAmountStackName } from '@router/configs';

import AvatarIcon from '@assets/icons/avatar.svg';
import ShareIcon from '@assets/icons/share.svg';
import SetAmountIcon from '@assets/icons/setAmount.svg';
import { useAtom } from 'jotai';
import setTokenQRInfoAtom from '@hooks/useSetAmount';
import { AssetType } from '@core/database/models/Asset';
import CFXTokenIcon from '@assets/icons/cfxToken.svg';
import MixinImage from '@components/MixinImage';
import DefaultTokenIcon from '@assets/icons/defaultToken.svg';
import { ETHURL, encodeETHURL } from '@utils/ETHURL';
import { useFocusEffect } from '@react-navigation/native';
import { formatUnits } from 'ethers';
import Decimal from 'decimal.js';

const Receive: React.FC<NativeStackScreenProps<RootStackList, 'Receive'>> = ({ navigation }) => {
  const { theme } = useTheme();

  const currentAddressValue = useCurrentAddressValue()!;
  const currentAccount = useCurrentAccount();
  const [shareDisabled, setShareDisabled] = useState(true);
  const [setAmountDisabled, setSetAmountDisabled] = useState(false);

  const [currentToken, setCurrentToken] = useAtom(setTokenQRInfoAtom);
  const handleSetAmount = () => {
    navigation.navigate(SetAmountStackName);
  };

  const getQRValue = () => {
    const encodeValues: ETHURL = {
      schema_prefix: 'ethereum',
      target_address: currentAddressValue,
      parameters: currentToken?.parameters,
    };

    if (currentToken?.type !== AssetType.Native) {
      encodeValues.function_name = 'transfer';
    }
    return encodeETHURL(encodeValues);
  };

  const getAmount = () => {
    if (currentToken) {
      if (currentToken.parameters) {
        const { value, uint256 } = currentToken.parameters;
        if (value || uint256) {
          return `${new Decimal(formatUnits((value || uint256) as bigint, currentToken.decimals)).toString()} ${currentToken.symbol}`;
        }
      }
    }

    return `0 ${currentToken.symbol}`;
  };
  useFocusEffect(
    useCallback(() => {
      return () => {
        setCurrentToken(null);
      };
    }, [setCurrentToken])
  );

  return (
    <SafeAreaView
      className="flex flex-1  flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <ScrollView className="flex-1">
        <View className="flex w-full items-center">
          <View className="w-20 h-20 rounded-full bg-slate-300">
            {currentToken &&
              (currentToken.type === AssetType.Native ? (
                <CFXTokenIcon width={80} height={80} />
              ) : currentToken.icon ? (
                <MixinImage
                  source={{ uri: currentToken.icon }}
                  fallback={<DefaultTokenIcon width={80} height={80} />}
                  width={80}
                  height={80}
                  resizeMode="center"
                />
              ) : (
                <DefaultTokenIcon width={80} height={80} />
              ))}
          </View>
        </View>
        <Divider className="my-4" />

        <View className="flex w-full items-center">
          <QRCode value={getQRValue()} size={223} />
        </View>
        <Text className=" font-bold text-3xl text-center py-4" style={{ color: theme.colors.textBrand }}>
          {getAmount()}
        </Text>

        <View className="mt-auto">
          <View className="flex">
            <View className="flex flex-row items-center">
              <AvatarIcon width={24} height={24} />
              <Text className="ml-2 leading-6">{currentAccount?.nickname}</Text>
            </View>
            <View className="ml-8 shrink">
              <Text style={{ color: theme.colors.textSecondary }} className="leading-6">
                {currentAddressValue}
              </Text>
            </View>
          </View>
          <Divider className="my-4" />
          <Text className="leading-6 px-9">Only send Conflux eSpace network assets to this address.</Text>

          <View className="flex flex-row justify-center mt-auto">
            <View className="mr-9">
              <Button testID="share" type="clear" buttonStyle={{ display: 'flex', flexDirection: 'column' }}>
                <View className="w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceThird }}>
                  <ShareIcon width={60} height={60} color={shareDisabled ? theme.colors.surfaceSecondary : theme.colors.surfaceBrand} />
                </View>
                <Text style={{ color: shareDisabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>Share</Text>
              </Button>
            </View>
            <View className="ml-9">
              <Button testID="setAmount" type="clear" buttonStyle={{ display: 'flex', flexDirection: 'column' }} onPress={handleSetAmount}>
                <View className="w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceThird }}>
                  <SetAmountIcon width={60} height={60} color={setAmountDisabled ? theme.colors.surfaceThird : theme.colors.surfaceBrand} />
                </View>
                <Text style={{ color: setAmountDisabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>Set Amount</Text>
              </Button>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Receive;
