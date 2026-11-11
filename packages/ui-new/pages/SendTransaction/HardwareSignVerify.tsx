import ArrowLeft from '@assets/icons/arrow-left2.svg';
import FailedIcon from '@assets/icons/message-fail.svg';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import Button from '@components/Button';
import Sheet, { SheetFooter, SheetHandle, SheetScrollView } from '@components/Sheet';
import Spinner from '@components/Spinner';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { HardwareSigningUiState } from './Step4Confirm/useHardwareSigningUiState';

interface Props {
  state: HardwareSigningUiState;
  onClose: () => void;
  onRetry: () => void;
}

const HardwareSignVerify: React.FC<Props> = ({ state, onClose, onRetry }) => {
  const { colors, reverseColors, mode } = useTheme();
  const { t } = useTranslation();

  const isError = state?.phase === 'error';

  const message = useMemo(() => {
    if (state?.phase === 'error') {
      return state.error?.message ?? t('tx.confirm.error.unknown');
    }
    return `${t('tx.confirm.BSIM.message')}...`;
  }, [state, t]);

  return (
    <Sheet isPresented={state !== null} height={{ height: 360 }} containerColor={colors.bgFourth} onDismiss={onClose}>
      <SheetHandle />
      <View style={styles.container}>
        <View style={styles.header}>
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
        </View>

        <SheetScrollView>
          <View style={styles.content}>
            <Image style={styles.bsimImg} source={BSIMCardWallet} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tip, { color: colors.textPrimary }]}>{message}</Text>
            </View>
          </View>
        </SheetScrollView>

        <SheetFooter style={styles.btnArea}>
          <Button testID="close" size="small" square Icon={ArrowLeft} onPress={onClose} />
          <Button testID="retry" style={styles.btnRetry} size="small" onPress={onRetry} loading={!isError}>
            {!isError ? '' : t('common.retry')}
          </Button>
        </SheetFooter>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    paddingVertical: 8,
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
    paddingHorizontal: 0,
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
  },
  btnRetry: {
    flex: 1,
  },
});

export default HardwareSignVerify;
