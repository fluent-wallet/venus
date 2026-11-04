import Img from '@assets/images/backup.webp';
import Button from '@components/Button';
import { SheetBody, SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type { StackScreenProps, TooManyPendingStackName } from '@router/configs';
import { getExternalRequestsService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { Image } from 'expo-image';
import type React from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

const TooManyPending: React.FC<StackScreenProps<typeof TooManyPendingStackName>> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: currentNetwork } = useCurrentNetwork();
  const requestId = route.params && typeof route.params === 'object' ? route.params.requestId : undefined;

  useEffect(
    () => () => {
      if (!requestId) return;
      try {
        getExternalRequestsService().reject({ requestId, error: new Error('Too many pending transactions.') });
      } catch {
        // ignore
      }
    },
    [requestId],
  );

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHeader title={t('tx.tooManyPending.title')} />
      <SheetScrollView>
        <SheetBody>
          <Image style={styles.img} source={Img} contentFit="contain" />
          <Text style={[styles.text, { color: colors.textPrimary }]}>
            {t('tx.tooManyPending.description', {
              network: currentNetwork?.name,
            })}
          </Text>
        </SheetBody>
      </SheetScrollView>
      <SheetFooter>
        <Button testID="confirm" style={styles.btn} size="small" onPress={() => navigation.goBack()}>
          {t('common.ok')}
        </Button>
      </SheetFooter>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  img: {
    alignSelf: 'center',
    width: 120,
    aspectRatio: 1,
  },
  text: {
    marginTop: 16,
    fontWeight: '300',
    fontSize: 16,
    lineHeight: 20,
  },
  btn: {},
});

export default TooManyPending;
