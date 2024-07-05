import { useAppOfSignature, useTxOfSignature } from '@core/WalletCore/Plugins/ReactInject/data/useSignature';
import type { Signature } from '@core/database/models/Signature';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { Pressable, StyleSheet, View } from 'react-native';
import dayjs from 'dayjs';
import { SignType } from '@core/database/models/Signature/type';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const SignatureItem: React.FC<{ item: Signature }> = ({ item }) => {
  const [folded, setFolded] = useState(true);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const app = useAppOfSignature(item);
  const tx = useTxOfSignature(item);
  const time = dayjs(item.createdAt).format('YYYY/MM/DD HH:mm:ss');
  const isTxSignature = item.signType === SignType.TX;
  return (
    <View style={[styles.item, { borderColor: colors.borderThird }]}>
      <Text style={[styles.time, { color: colors.textSecondary }]}>{time}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{!isTxSignature ? 'Sign Data' : tx?.method}</Text>
      {!isTxSignature && (
        <>
          <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={folded ? 2 : undefined}>
            {item.message}
          </Text>
          {/* TODO: more style */}
          {folded && (
            <Pressable onPress={() => setFolded(false)} testID="more">
              <Text style={[styles.action, { color: colors.actionPrimary }]}>{t('signature.list.showMore')}</Text>
            </Pressable>
          )}
        </>
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
  message: {
    fontSize: 14,
    fontWeight: '300',
    marginTop: 16,
  },
  action: {
    fontSize: 14,
    fontWeight: '300',
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
