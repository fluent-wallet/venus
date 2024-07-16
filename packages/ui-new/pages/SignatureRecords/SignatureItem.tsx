import { useAppOfSignature, useTxOfSignature } from '@core/WalletCore/Plugins/ReactInject/data/useSignature';
import type { Signature } from '@core/database/models/Signature';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { Pressable, StyleSheet, View } from 'react-native';
import dayjs from 'dayjs';
import { SignType } from '@core/database/models/Signature/type';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Clipboard from '@react-native-clipboard/clipboard';
import Copy from '@assets/icons/copy.svg';
import { showMessage } from 'react-native-flash-message';

const substrWithChinese = (str: string, start: number, n: number, suffix = '...') => {
  if (str.replace(/[\u4e00-\u9fa5]/g, '**').length <= n) {
    return str;
  }
  let len = 0;
  let result = '';
  for (let i = start; i < str.length; i++) {
    if (/[\u4e00-\u9fa5]/.test(str[i])) {
      len += 2;
    } else {
      len += 1;
    }
    if (len > n) {
      if (suffix) {
        result += suffix;
      }
      break;
    }
    result += str[i];
  }
  return result;
};

export const SignatureItem: React.FC<{ item: Signature; maxMessageLength: number }> = ({ item, maxMessageLength }) => {
  const [folded, setFolded] = useState(true);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const app = useAppOfSignature(item.id);
  const tx = useTxOfSignature(item.id);
  const time = dayjs(item.createdAt).format('YYYY/MM/DD HH:mm:ss');
  const isTxSignature = item.signType === SignType.TX;
  const ellipsisMessage = useMemo(() => {
    if (isTxSignature) return '';
    return substrWithChinese(item.message ?? '', 0, maxMessageLength);
  }, [isTxSignature, item.message, maxMessageLength]);
  const isFolded = folded && ellipsisMessage && ellipsisMessage !== item.message;
  const handleCopy = useCallback(() => {
    Clipboard.setString(item.message ?? '');
    showMessage({
      message: t('common.copied'),
      type: 'success',
      duration: 1500,
      width: 160,
    });
  }, [item.message, t]);
  return (
    <View style={[styles.item, { borderColor: colors.borderThird }]}>
      <Text style={[styles.time, { color: colors.textSecondary }]}>{time}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{!isTxSignature ? 'Sign Data' : tx?.method}</Text>
      {!isTxSignature && (
        <View style={styles.messageContainer}>
          <Text style={[styles.message, { color: colors.textPrimary, flex: 1 }]}>
            {isFolded ? ellipsisMessage : item.message}
            {isFolded && (
              <Text onPress={() => setFolded(false)} testID="more" style={[styles.action, { color: colors.up }]}>
                {t('signature.list.showMore')}
              </Text>
            )}
          </Text>
          {!isFolded && (
            <Pressable style={styles.copy} onPress={handleCopy} testID="copy">
              <Copy color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}
      {app && (
        <View style={styles.app}>
          <Image style={styles.icon} source={app.icon} contentFit="contain" />
          <Text style={[styles.url, { color: colors.textPrimary }]}>{app.origin}</Text>
        </View>
      )}
    </View>
  );
};

export const styles = StyleSheet.create({
  item: {
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: 8,
  },
  time: {
    fontSize: 12,
    fontWeight: '300',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  messageContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
  },
  message: {
    fontSize: 14,
    fontWeight: '300',
    flex: 1,
  },
  action: {
    fontSize: 14,
    fontWeight: '300',
    textDecorationLine: 'underline',
  },
  copy: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  app: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
  },
  url: {
    fontSize: 16,
    fontWeight: '300',
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
