import { useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, View, KeyboardAvoidingView, TextInput } from 'react-native';
import { Button, Icon } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';

export const SetAmountStackName = 'SetAmount';

const SetAmount = () => {
  const { theme } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [value, setValue] = useState('0');
  const [inputTextSize, setInputTextSize] = useState(60);

  const snapPoints = useMemo(() => ['25%', '50%'], []);

  const handleClose = () => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
  };
  const handleSelectToken = () => {
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
  };

  return (
    <KeyboardAvoidingView behavior={'padding'} className="flex-1">
      <SafeAreaView
        className="flex flex-1  flex-col justify-start px-[24px] pb-6"
        style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
      >
        <Text className="text-xl text-center font-bold">Select a token</Text>

        <View className="flex items-center">
          <View className="w-56 mt-3">
            <Button
              buttonStyle={{ backgroundColor: theme.colors.surfaceThird, borderRadius: 40, paddingHorizontal: 12, paddingVertical: 8 }}
              onPress={handleSelectToken}
            >
              <View className="flex flex-1 flex-row justify-between items-center">
                <View className="flex flex-row items-center">
                  <TokenIconDefault />
                  <View>
                    <Text>Bitcoin</Text>
                    <Text style={{ color: theme.colors.textSecondary }}>BTC</Text>
                  </View>
                </View>
                <Icon name="keyboard-arrow-down" color={'#A3A3A3'} size={24} />
              </View>
            </Button>
          </View>
        </View>

        <TextInput
          value={value}
          onChangeText={handleChange}
          inputMode="decimal"
          className="text-center text-6xl  font-bold leading-tight"
          style={{ color: theme.colors.textBrand, fontSize: inputTextSize }}
        />

        <Text style={{ color: theme.colors.textSecondary }} className="text-center">
          HKDC
        </Text>
        <Text style={{ color: theme.colors.textSecondary }} className="text-center">
          ≈$9.41
        </Text>

        <BaseButton containerStyle={{ marginTop: 'auto' }}>
          <Text>Continue</Text>
        </BaseButton>

        <BottomSheet
          index={-1}
          onChange={(index) => {
            index === -1 && handleSelectToken();
          }}
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
          <BottomSheetFlatList
            style={{ paddingHorizontal: 25 }}
            data={[
              {
                tokenName: 'Bitcoin',
                tokenIcon: TokenIconDefault,
                tokenValue: '20000000',
                tokenBalance: 0,
              },
            ]}
            renderItem={({ item: { tokenName, tokenIcon: TokenIcon, tokenValue, tokenBalance } }) => (
              <View className="flex flex-row justify-between items-center p-3 mb-4">
                <View className="flex flex-row items-center">
                  <TokenIcon width={48} height={48} className="mr-4" />
                  <Text>{tokenName}</Text>
                </View>
                <View>
                  <Text className="text-base leading-5 self-end">{tokenBalance}</Text>
                  <Text style={{ color: theme.colors.textSecondary }}>${tokenValue}</Text>
                </View>
              </View>
            )}
          />
        </BottomSheet>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default SetAmount;
