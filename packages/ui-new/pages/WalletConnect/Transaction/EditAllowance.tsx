import BottomSheet, {
  BottomSheetTextInput,
  BottomSheetWrapper,
  BottomSheetScrollContent,
  BottomSheetHeader,
  BottomSheetFooter,
  type BottomSheetMethods,
} from '@components/BottomSheet';
import Checkbox from '@components/Checkbox';
import ArrowLeft from '@assets/icons/arrow-left2.svg';
import Button from '@components/Button';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import { useTheme } from '@react-navigation/native';
import { isNumeric } from '@utils/isNumberic';
import { isApproveMethod } from '@utils/parseTxData';
import Decimal from 'decimal.js';
import { formatUnits } from 'ethers';
import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type NativeSyntheticEvent, Pressable, StyleSheet, Text, type TextInputChangeEventData, View } from 'react-native';
import type { TxDataWithTokenInfo } from '.';

interface IProps {
  parseData: TxDataWithTokenInfo;
  savedValue?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function EditAllowance({ parseData, savedValue, onSave, onClose }: IProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const [isDappSuggestValue, setIsDappSuggestValue] = useState(!savedValue);
  const [customValue, setCustomValue] = useState(savedValue || '');
  const [percent, setPercent] = useState<null | number>(null);
  const [invalidNumber, setInvalidNumber] = useState(false);

  const handleChange = (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
    if (isDappSuggestValue) return;
    const newValue = event.nativeEvent.text;
    setCustomValue(newValue);
    if (newValue !== customValue && percent !== null) {
      setPercent(null);
    }
  };

  const handleSave = useCallback(() => {
    setInvalidNumber(false);
    if (isDappSuggestValue) {
      onSave('');
      bottomSheetRef.current?.close();
    } else {
      if (isNumeric(customValue)) {
        onSave(customValue);
        bottomSheetRef.current?.close();
      } else {
        setInvalidNumber(true);
      }
    }
  }, [onSave, isDappSuggestValue, customValue]);

  const getFormatValue = useCallback(
    (value: bigint) => {
      if (parseData?.decimals) {
        return formatUnits(value, parseData.decimals);
      }
      return value.toString();
    },
    [parseData],
  );

  const handlePercent = useCallback(
    (value: number | null) => {
      if (parseData.balance) {
        if (value) {
          const balance = new Decimal(parseData.balance);
          const percentValue = balance.mul(value / 100);
          const showValue = parseData.decimals ? percentValue.div(new Decimal(10).pow(parseData.decimals)) : percentValue;
          setCustomValue(showValue.toString());
        }
        setPercent(value);
      }
    },
    [parseData.balance, parseData.decimals],
  );

  return (
    <BottomSheet ref={bottomSheetRef} index={0} snapPoints={snapPoints} onClose={onClose}>
      <BottomSheetWrapper>
        <BottomSheetHeader title={t('wc.dapp.tx.editAllowance')} />
        <BottomSheetScrollContent innerPaddingHorizontal>
          <View style={styles.editItem}>
            <Checkbox checked={isDappSuggestValue} onChange={() => setIsDappSuggestValue(!isDappSuggestValue)} />

            <View>
              <Text style={[styles.editSuggest, { color: colors.textPrimary, fontWeight: isDappSuggestValue ? '600' : '400' }]}>
                {t('wc.dapp.tx.DAppSuggestions')}
              </Text>
              <Text style={[styles.editSuggest, { color: colors.textPrimary, fontWeight: isDappSuggestValue ? '600' : '400' }]}>
                {t('common.use')}
                <Text style={[styles.editSuggest, { color: colors.textNotice, fontWeight: isDappSuggestValue ? '600' : '400' }]}>
                  {' '}
                  {parseData && isApproveMethod(parseData) ? (parseData.isUnlimited ? t('wc.dapp.tx.unlimited') : getFormatValue(parseData.value)) : ''}{' '}
                </Text>
                {parseData?.symbol}
              </Text>
            </View>
          </View>

          <View style={styles.editItem}>
            <Checkbox checked={!isDappSuggestValue} onChange={() => setIsDappSuggestValue(!isDappSuggestValue)} />
            <View style={styles.flex1}>
              <Text style={[styles.secondary, { color: colors.textPrimary, fontWeight: !isDappSuggestValue ? '600' : '400' }]}>{t('common.customize')}</Text>
              <View pointerEvents={isDappSuggestValue ? 'none' : 'auto'}>
                <BottomSheetTextInput
                  readOnly={isDappSuggestValue}
                  editable={!isDappSuggestValue}
                  inputMode="numeric"
                  style={[
                    styles.editInput,
                    { borderColor: invalidNumber ? colors.down : isDappSuggestValue ? colors.borderFourth : colors.up, color: colors.textPrimary },
                  ]}
                  value={customValue}
                  onChange={handleChange}
                />
              </View>
              {parseData?.balance && (
                <View style={[styles.flexRow, { justifyContent: 'space-between' }]}>
                  <Text style={{ color: colors.textSecondary }}>{t('wc.dapp.tx.shareOfBalance')}</Text>
                  <View style={[styles.flexRow, styles.balanceChoose]}>
                    {[25, 50, 100].map((p) => (
                      <Pressable
                        disabled={isDappSuggestValue}
                        key={p}
                        testID="25"
                        style={[
                          styles.balanceBtn,
                          { borderColor: isDappSuggestValue ? colors.borderFourth : colors.up, backgroundColor: p === percent ? colors.up : colors.bgFourth },
                        ]}
                        onPress={() => handlePercent(percent === p ? null : p)}
                      >
                        <Text style={{ color: p === percent ? colors.textFifth : isDappSuggestValue ? colors.textSecondary : colors.up }}>{`${p}%`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </BottomSheetScrollContent>
        <BottomSheetFooter>
          <View style={transactionConfirmStyle.btnArea}>
            <Button testID="close" square Icon={ArrowLeft} onPress={() => bottomSheetRef?.current?.close()} />
            <Button testID="save" style={styles.flex1} onPress={handleSave}>
              {t('common.save')}
            </Button>
          </View>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheet>
  );
}

const snapPoints = [480];

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  secondary: {
    fontSize: 14,
    fontWeight: '300',
  },
  flexRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
  },
  editItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  editSuggest: {
    marginBottom: 8,
    fontSize: 14,
  },
  editInput: {
    width: '100%',
    borderWidth: 1,
    fontSize: 20,
    borderRadius: 6,
    marginVertical: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnArea: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
    marginBottom: 79,
  },
  balanceChoose: {
    gap: 8,
  },
  balanceBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
