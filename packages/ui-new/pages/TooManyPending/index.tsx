import Img from '@assets/images/backup.webp';
import {
  BottomSheetWrapper,
  BottomSheetHeader,
  BottomSheetContent,
  BottomSheetFooter,
  type BottomSheetMethods,
  BottomSheetRoute,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import type { IWCSendTransactionEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import type { TooManyPendingStackName, StackScreenProps } from '@router/configs';
import { Image } from 'expo-image';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

const TooManyPending: React.FC<StackScreenProps<typeof TooManyPendingStackName>> = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork();

  return (
    <BottomSheetRoute
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onClose={() => {
        const currentEvent = plugins.WalletConnect.currentEventSubject.getValue() as IWCSendTransactionEvent;
        if (!currentEvent) return;
        currentEvent?.action?.reject?.('Too many pending transactions.');
      }}
    >
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('tx.tooManyPending.title')} />
        <BottomSheetContent>
          <Image style={styles.img} source={Img} contentFit="contain" />
          <Text style={[styles.text, { color: colors.textPrimary }]}>
            {t('tx.tooManyPending.description', {
              network: currentNetwork?.name,
            })}
          </Text>
        </BottomSheetContent>
        <BottomSheetFooter>
          <Button testID="confirm" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
            {t('common.ok')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

const snapPoints = [480];

const styles = StyleSheet.create({
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
