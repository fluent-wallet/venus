import { useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, View, KeyboardAvoidingView, TextInput } from 'react-native';
import { Icon } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import TokenList from '@modules/AssetList/TokenList';
import { useAtom } from 'jotai';
import setTokenQRInfoAtom from '@hooks/useSetAmount';
import { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenIcon from '@components/TokenIcon';
import { AssetType } from '@core/database/models/Asset';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackList } from '@router/configs';
import { parseUnits } from 'ethers';
const SetAmount: React.FC<NativeStackScreenProps<RootStackList, 'SetAmount'>> = ({ navigation }) => {
  const { theme } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [value, setValue] = useState('');
  const [inputTextSize, setInputTextSize] = useState(60);
  const [currentToken, setCurrentToken] = useAtom(setTokenQRInfoAtom);
  const [inputError, setInputError] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const snapPoints = useMemo(() => ['25%', '50%'], []);

  const handleClose = () => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
      setSheetOpen((bl) => !bl);
    }
  };
  const handleSelectToken = () => {
    if (inputRef.current) {
      inputRef.current.blur();
    }

    if (bottomSheetRef.current) {
      if (sheetOpen) {
        bottomSheetRef.current.close();
      } else {
        bottomSheetRef.current.expand();
      }

      setSheetOpen((bl) => !bl);
    }
  };

  const handleChange = (v: string) => {
    if (v.length > 10) {
      setInputTextSize(30);
    } else {
      setInputTextSize(60);
    }
    setValue(v);
    if (isNaN(Number(v))) {
      setInputError(true);
    } else {
      setInputError(false);
    }
  };

  const handleChangeSelectedToken = (v: AssetInfo) => {
    setCurrentToken(v);
    bottomSheetRef.current?.close();
    setSheetOpen(false);
  };

  const handleContinue = () => {
    if (!value || isNaN(Number(value))) {
      return setInputError(true);
    }

    if (currentToken) {
      if (currentToken.type === AssetType.Native) {
        setCurrentToken({ ...currentToken, parameters: { value: currentToken.decimals ? parseUnits(value, currentToken.decimals) : BigInt(value) } });
      } else {
        setCurrentToken({
          ...currentToken,
          parameters: { address: currentToken.contractAddress, uint256: currentToken.decimals ? parseUnits(value, currentToken.decimals) : BigInt(value) },
        });
      }
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView behavior={'padding'} className="flex-1">
      <SafeAreaView
        className="flex flex-1  flex-col justify-start px-[24px] pb-6"
        style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
      >
        <Text className="text-xl text-center font-bold">Select a token</Text>

        <View className="flex">
          <Pressable
            testID="selectToken"
            className="flex flex-row items-center mx-auto px-3 py-2 min-w-[196px]  rounded-[40px] mt-2"
            style={{ backgroundColor: theme.colors.surfaceThird }}
            onPress={handleSelectToken}
          >
            <View className="flex flex-row items-center">
              <View className="mr-2">{currentToken && <TokenIcon type={currentToken.type} url={currentToken.icon} width={48} height={48} />}</View>
              <View>
                <Text>{currentToken?.name}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>{currentToken?.symbol}</Text>
              </View>
            </View>
            <View className="ml-auto">
              <Icon name="keyboard-arrow-down" color={theme.colors.surfaceFourth} size={24} />
            </View>
          </Pressable>
        </View>

        <TextInput
          testID="amountInput"
          autoFocus
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          inputMode="numeric"
          className="text-center text-6xl  font-bold leading-tight mt-[60px]"
          style={{
            color: theme.colors.textBrand,
            fontSize: inputTextSize,
            borderBottomWidth: 1,
            borderBottomColor: inputError ? theme.colors.warnErrorPrimary : 'transparent',
          }}
        />

        <Text style={{ color: theme.colors.textSecondary }} className="text-center">
          {currentToken?.symbol}
        </Text>
        {currentToken?.priceInUSDT && (
          <Text style={{ color: theme.colors.textSecondary }} className="text-center">
            {!inputError && `≈${(Number(value) * Number(currentToken.priceInUSDT)).toFixed(2)}`}
          </Text>
        )}

        <BaseButton testID="continue" containerStyle={{ marginTop: 'auto' }} disabled={inputError} onPress={handleContinue}>
          <Text style={{ color: theme.colors.textInvert }}>Continue</Text>
        </BaseButton>

        <BottomSheet
          index={-1}
          enablePanDownToClose
          ref={bottomSheetRef}
          snapPoints={snapPoints}
          handleStyle={{ backgroundColor: theme.colors.textSecondary }}
          backgroundStyle={{ backgroundColor: theme.colors.surfaceCard }}
          backdropComponent={({ style }) =>
            sheetOpen ? <Pressable onPress={handleClose} style={[{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }, style]}></Pressable> : null
          }
          handleComponent={() => (
            <View className="flex items-center">
              <View className="w-9 h-1 m-2 rounded" style={{ backgroundColor: theme.colors.textSecondary }} />
            </View>
          )}
        >
          <TokenList skeleton={6} RenderList={BottomSheetFlatList} onPress={handleChangeSelectedToken} from="receive" />
        </BottomSheet>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default SetAmount;
