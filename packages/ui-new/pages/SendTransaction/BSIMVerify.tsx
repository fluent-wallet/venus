import { BSIM_ERRORS } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import { type BSIMEvent, BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import ArrowLeft from '@assets/icons/arrow-left2.svg';
import FailedIcon from '@assets/icons/message-fail.svg';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Spinner from '@components/Spinner';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { screenHeight } from '@utils/deviceInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

interface Props {
  bsimEvent: BSIMEvent;
  onClose: () => void;
  onRetry: () => void;
}

const BSIMVerify: React.FC<Props> = ({ bsimEvent, onClose, onRetry }) => {
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const { colors, reverseColors, mode } = useTheme();
  const { t } = useTranslation();

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={onClose} index={0}>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          {bsimEvent.type !== BSIMEventTypesName.ERROR && (
            <View style={{ width: 24, height: 24, marginRight: 4, justifyContent: 'center', alignItems: 'center', transform: [{ translateY: 1 }] }}>
              <Spinner width={20} height={20} color={reverseColors[mode === 'light' ? 'iconPrimary' : 'textSecondary']} backgroundColor={colors.iconPrimary} />
            </View>
          )}
          {bsimEvent.type === BSIMEventTypesName.ERROR && (
            <FailedIcon style={{ marginRight: 4, transform: [{ translateY: 1 }] }} color={colors.down} width={24} height={24} />
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {bsimEvent.type === BSIMEventTypesName.ERROR ? t('tx.confirm.BSIM.error.title') : t('tx.confirm.BSIM.title')}
          </Text>
        </View>

        <View style={styles.content}>
          <Image style={styles.bsimImg} source={BSIMCardWallet} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tip, { color: colors.textPrimary }]}>
              {bsimEvent.type === BSIMEventTypesName.ERROR ? bsimEvent.message : `${t('tx.confirm.BSIM.message')}...`}
            </Text>
          </View>
        </View>

        <View style={styles.btnArea}>
          <Button testID="close" size="small" square Icon={ArrowLeft} onPress={() => bottomSheetRef.current?.close()} />
          <Button testID="retry" style={styles.btnRetry} size="small" onPress={onRetry} loading={bsimEvent.type !== BSIMEventTypesName.ERROR}>
            {bsimEvent.type !== BSIMEventTypesName.ERROR ? '' : t('common.retry')}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

export const useBSIMVerify = () => {
  const [bsimEvent, _setBSIMEvent] = useState<BSIMEvent | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const bsimCancelRef = useRef<VoidFunction | null>(null);

  const execBSIMCancel = useCallback(() => {
    bsimCancelRef.current?.();
  }, []);
  const setBSIMCancel = useCallback((cancelFunc: VoidFunction | null) => {
    bsimCancelRef.current = cancelFunc;
  }, []);

  const setBSIMEvent = useCallback((event: BSIMEvent | null) => {
    if (event && typeof event.message === 'string' && event.message.includes(BSIM_ERRORS.cancel)) return;
    _setBSIMEvent(event);
  }, []);

  return {
    execBSIMCancel,
    setBSIMCancel,
    bsimEvent,
    setBSIMEvent,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 26,
  },
  tip: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
    width: '100%',
    flex: 1,
  },
  content: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 38,
    paddingRight: 16,
  },
  bsimImg: {
    width: 60,
    height: 60,
  },
  btnArea: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
  },
  btnRetry: {
    flex: 1,
  },
});

const snapPoints = [`${((260 / screenHeight) * 100).toFixed(2)}%`];

export default BSIMVerify;
