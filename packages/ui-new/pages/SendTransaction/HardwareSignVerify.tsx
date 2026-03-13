import ArrowLeft from '@assets/icons/arrow-left2.svg';
import FailedIcon from '@assets/icons/message-fail.svg';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import {
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetScrollContent,
  BottomSheetWrapper,
  InlineBottomSheet,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Spinner from '@components/Spinner';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { screenHeight } from '@utils/deviceInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { HardwareSigningUiState } from './Step4Confirm/useHardwareSigningUiState';

interface Props {
  state: Exclude<HardwareSigningUiState, null>;
  onClose: () => void;
  onRetry: () => void;
}

const HardwareSignVerify: React.FC<Props> = ({ state, onClose, onRetry }) => {
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const { colors, reverseColors, mode } = useTheme();
  const { t } = useTranslation();

  const isError = state.phase === 'error';

  const message = useMemo(() => {
    if (!isError) {
      return `${t('tx.confirm.BSIM.message')}...`;
    }
    return state.error?.message ?? t('tx.confirm.error.unknown');
  }, [isError, state?.error?.message, t]);

  return (
    <InlineBottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={onClose} index={0}>
      <BottomSheetWrapper innerPaddingHorizontal style={styles.container}>
        <BottomSheetHeader>
          <View style={styles.titleContainer}>
            {!isError && (
              <View style={styles.spinner}>
                <Spinner
                  width={20}
                  height={20}
                  color={reverseColors[mode === 'light' ? 'iconPrimary' : 'textSecondary']}
                  backgroundColor={colors.iconPrimary}
                />
              </View>
            )}
            {isError && <FailedIcon style={styles.failedIcon} color={colors.down} width={24} height={24} />}
            <Text style={[styles.title, { color: colors.textPrimary }]}>{isError ? t('tx.confirm.BSIM.error.title') : t('tx.confirm.BSIM.title')}</Text>
          </View>
        </BottomSheetHeader>

        <BottomSheetScrollContent>
          <View style={styles.content}>
            <Image style={styles.bsimImg} source={BSIMCardWallet} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tip, { color: colors.textPrimary }]}>{message}</Text>
            </View>
          </View>
        </BottomSheetScrollContent>

        <BottomSheetFooter style={styles.btnArea}>
          <Button testID="close" size="small" square Icon={ArrowLeft} onPress={() => bottomSheetRef.current?.close()} />
          <Button testID="retry" style={styles.btnRetry} size="small" onPress={onRetry} loading={!isError}>
            {!isError ? '' : t('common.retry')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </InlineBottomSheet>
  );
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
  spinner: {
    width: 24,
    height: 24,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateY: 1 }],
  },
  failedIcon: {
    marginRight: 4,
    transform: [{ translateY: 1 }],
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

const snapPoints = [`${((360 / screenHeight) * 100).toFixed(2)}%`];

export default HardwareSignVerify;
