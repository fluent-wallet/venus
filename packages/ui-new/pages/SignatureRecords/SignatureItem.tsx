import Copy from '@assets/icons/copy.svg';
import { PlaintextMessage } from '@components/PlaintextMessage';
import Text from '@components/Text';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import { useAppOfSignature, useTxOfSignature } from '@core/WalletCore/Plugins/ReactInject/data/useSignature';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '@react-navigation/native';
import dayjs from 'dayjs';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
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
  const { shownMessage, jsonMessage } = useMemo(() => {
    let jsonMessage: any = {};
    let shownMessage = item.message ?? '';
    try {
      if (item.signType === SignType.TX) {
        shownMessage = '';
      } else if (item.signType === SignType.JSON) {
        jsonMessage = JSON.parse(shownMessage).message || {};
        shownMessage = JSON.stringify(jsonMessage) ?? '';
      }
      return {
        shownMessage,
        jsonMessage,
      };
    } catch (error) {
      console.log('parse message error:', error);
      return {
        shownMessage,
        jsonMessage,
      };
    }
  }, [item]);
  const ellipsisMessage = useMemo(() => {
    return substrWithChinese(shownMessage, 0, maxMessageLength);
  }, [shownMessage, maxMessageLength]);
  const isFolded = folded && ellipsisMessage && ellipsisMessage !== shownMessage;
  const handleCopy = useCallback(() => {
    Clipboard.setString(shownMessage);
    showMessage({
      message: t('common.copied'),
      type: 'success',
      duration: 1500,
      width: 160,
    });
  }, [shownMessage, t]);
  return (
    <View style={[styles.item, { borderColor: colors.borderThird }]}>
      <Text style={[styles.time, { color: colors.textSecondary }]}>{time}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{!isTxSignature ? 'Sign Data' : tx?.method}</Text>
      {!isTxSignature && (
        <View style={styles.messageContainer}>
          <View style={[styles.message, isFolded ? { display: 'flex', flexDirection: 'row', alignItems: 'flex-end' } : {}]}>
            {isFolded ? (
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>{ellipsisMessage}</Text>
            ) : item.signType === SignType.JSON ? (
              <PlaintextMessage data={jsonMessage} />
            ) : (
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>{shownMessage}</Text>
            )}
            {isFolded && (
              <Text onPress={() => setFolded(false)} testID="more" style={[styles.action, { color: colors.up }]}>
                {t('signature.list.showMore')}
              </Text>
            )}
          </View>
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
    flex: 1,
  },
  messageText: {
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
