import BottomSheet, { snapPoints } from '@components/BottomSheet';
import Checkbox from '@components/Checkbox';

import { useTheme } from '@react-navigation/native';
import { isApproveMethod } from '@utils/parseTxData';
import { NativeSyntheticEvent, Pressable, StyleSheet, Text, TextInputChangeEventData, View } from 'react-native';
import { TxDataWithTokenInfo } from '.';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native-gesture-handler';
import Button from '@components/Button';
import ArrowLeft from '@assets/icons/arrow-left2.svg';
import { formatUnits, parseUnits } from 'ethers';
import Decimal from 'decimal.js';
interface IProps {
  open: boolean;
  parseData: TxDataWithTokenInfo;
  savedValue?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function EditAllowance({ open, parseData, savedValue, onSave, onClose }: IProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [isDappSuggestValue, setIsDappSuggestValue] = useState(!savedValue);
  const [customValue, setCustomValue] = useState(savedValue || '');
  const [percent, setPercent] = useState<null | number>(null);

  const handleChange = (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
    const newValue = event.nativeEvent.text;
    if (/^[0-9]*$/.test(newValue)) {
      setCustomValue(newValue);
    }
  };

  const handleSave = useCallback(() => {
    if (isDappSuggestValue) {
      onSave('');
    } else {
      onSave(parseData?.decimals ? parseUnits(customValue, parseData.decimals).toString() : customValue);
    }

    onClose();
  }, [onClose, onSave, isDappSuggestValue, customValue, parseData.decimals]);
  const getFormatValue = useCallback(
    (value: bigint) => {
      if (parseData && parseData.decimals) {
        return formatUnits(value, parseData.decimals);
      } else {
        return value.toString();
      }
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
    <BottomSheet index={open ? 0 : -1} enablePanDownToClose={false} backDropPressBehavior={'none'} snapPoints={snapPoints.percent65} style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wc.dapp.tx.editAllowance')}</Text>
      <View style={styles.editItem}>
        <Checkbox checked={isDappSuggestValue} onChange={() => setIsDappSuggestValue(!isDappSuggestValue)} />

        <View>
          <Text style={[styles.editSuggest, { color: colors.textPrimary }]}>{t('wc.dapp.tx.DAppSuggestions')}</Text>
          <Text style={[styles.editSuggest, { color: colors.textPrimary }]}>
            {t('common.use')}
            <Text style={[styles.editSuggest, { color: colors.textNotice }]}>
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
          <Text style={styles.secondary}>{t('common.customize')}</Text>
          <TextInput
            editable={!isDappSuggestValue}
            inputMode="numeric"
            style={[styles.editInput, { borderColor: isDappSuggestValue ? colors.borderFourth : colors.up }]}
            value={customValue}
            onChange={handleChange}
          />
          {parseData?.balance && (
            <View style={[styles.flexRow, { justifyContent: 'space-between' }]}>
              <Text>{t('wc.dapp.tx.shareOfBalance')}</Text>
              <View style={[styles.flexRow, styles.balanceChoose]}>
                {[25, 50, 100].map((p) => (
                  <Pressable
                    key={p}
                    testID="25"
                    style={[
                      styles.balanceBtn,
                      { borderColor: isDappSuggestValue ? colors.borderFourth : colors.up, backgroundColor: p === percent ? colors.up : colors.bgPrimary },
                    ]}
                    onPress={() => handlePercent(percent === p ? null : p)}
                  >
                    <Text style={{ color: p === percent ? colors.textFifth : isDappSuggestValue ? colors.borderFourth : colors.up }}>{p}%</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.btnArea}>
        <Button testID="close" square Icon={ArrowLeft} onPress={onClose} />
        <Button testID="save" style={styles.flex1} onPress={handleSave}>
          {t('common.save')}
        </Button>
      </View>
    </BottomSheet>
  );
}

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
  container: {
    paddingHorizontal: 16,
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
    marginBottom: 32,
  },
  editSuggest: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
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
