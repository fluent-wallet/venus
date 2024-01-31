import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@rneui/base';
import { Divider, Text, useTheme } from '@rneui/themed';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import Decimal from 'decimal.js';
import { useCurrentAccount, useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { type RootStackList, SetAmountStackName } from '@router/configs';
import setTokenQRInfoAtom from '@hooks/useSetAmount';
import { AssetType } from '@core/database/models/Asset';
import MixinImage from '@components/MixinImage';
import LinearGradientBackground from '@modules/Background/LinearGradient';
import { statusBarHeight } from '@utils/deviceInfo';
import { ETHURL, encodeETHURL } from '@utils/ETHURL';
import AvatarIcon from '@assets/icons/avatar.svg';
import ShareIcon from '@assets/icons/share.svg';
import SetAmountIcon from '@assets/icons/setAmount.svg';
import CFXTokenIcon from '@assets/icons/cfxToken.svg';
import DefaultTokenIcon from '@assets/icons/defaultToken.svg';
import { SHOW_SET_AMOUNT_FEATURE } from '@utils/features';
import { useAssetsHash } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';

const Receive: React.FC<NativeStackScreenProps<RootStackList, 'Receive'>> = ({ navigation }) => {
  const { theme } = useTheme();

  const currentAddressValue = useCurrentAddressValue()!;
  const currentAccount = useCurrentAccount();
  const [shareDisabled, setShareDisabled] = useState(true);
  const [setAmountDisabled, setSetAmountDisabled] = useState(!SHOW_SET_AMOUNT_FEATURE.allow);
  const assetsHash = useAssetsHash();
  const [userSelectToken, setUserSelectToken] = useAtom(setTokenQRInfoAtom);
  const handleSetAmount = () => {
    navigation.navigate(SetAmountStackName);
  };

const currentToken = userSelectToken || (assetsHash ? assetsHash[AssetType.Native] : null);

  const getQRValue = () => {
    // if get token list is not finished, return current address
    if (!currentToken) {
      return currentAddressValue;
    }
    const encodeValues: ETHURL = {
      schema_prefix: 'ethereum',
      target_address: currentAddressValue,
      parameters: currentToken?.parameters,
    };

    if (currentToken?.type !== AssetType.Native) {
      if (currentToken?.parameters?.address) {
        encodeValues.function_name = 'transfer';
      }
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

      return `0 ${currentToken.symbol ?? ''}`;
    }

    return '';
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        setUserSelectToken(null);
      };
    }, [setUserSelectToken]),
  );

  return (
    <SafeAreaView className="flex-1">
      <ScrollView contentContainerStyle={{ minHeight: '100%' }}>
        <LinearGradientBackground style={{ paddingTop: statusBarHeight + 48, paddingHorizontal: 24, paddingBottom: 28, minHeight: '100%' }}>
          <View className="flex items-center">
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
          {/* <Text className="font-bold text-3xl text-center py-4" style={{ color: theme.colors.textBrand }}>
            {getAmount()}
          </Text> */}

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
                <Button disabled={shareDisabled} testID="share" type="clear" buttonStyle={{ display: 'flex', flexDirection: 'column' }}>
                  <View className="w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceThird }}>
                    <ShareIcon width={60} height={60} color={shareDisabled ? theme.colors.surfaceSecondary : theme.colors.surfaceBrand} />
                  </View>
                  <Text style={{ color: shareDisabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>Share</Text>
                </Button>
              </View>
              <View className="ml-9">
                <Button
                  disabled={setAmountDisabled}
                  testID="setAmount"
                  type="clear"
                  buttonStyle={{ display: 'flex', flexDirection: 'column' }}
                  onPress={handleSetAmount}
                >
                  <View className="w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceThird }}>
                    <SetAmountIcon width={60} height={60} color={setAmountDisabled ? theme.colors.surfaceSecondary : theme.colors.surfaceBrand} />
                  </View>
                  <Text style={{ color: setAmountDisabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>Set Amount</Text>
                </Button>
              </View>
            </View>
          </View>
        </LinearGradientBackground>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Receive;
