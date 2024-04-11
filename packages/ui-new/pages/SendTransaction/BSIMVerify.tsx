import React, { type MutableRefObject } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import { BSIMEvent, BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import { screenHeight } from '@utils/deviceInfo';
import BSIMCardWallet from '@assets/icons/wallet-bsim2.webp';
import ArrowLeft from '@assets/icons/arrow-left2.svg';
import TxErrorIcon from '@assets/icons/txError.svg';
import { useTranslation } from 'react-i18next';

interface Props {
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
  bsimEvent: BSIMEvent;
  onClose: () => void;
  onRetry: () => void;
}

const BSIMVerify: React.FC<Props> = ({ bottomSheetRef, bsimEvent, onClose, onRetry }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={onClose} index={0}>
      <View style={styles.container}>
        {bsimEvent.type === BSIMEventTypesName.ERROR ? (
          <View style={styles.titleContainer}>
            <TxErrorIcon />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tx.confirm.BSIM.error.title')}</Text>
          </View>
        ) : (
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tx.confirm.BSIM.title')}</Text>
          </View>
        )}

        <View style={styles.content}>
          <Image style={styles.bsimImg} source={BSIMCardWallet} />
          <View style={{ flex: 1 }}>
            <Text style={(styles.tip, { color: colors.textPrimary })}>
              {bsimEvent.type === BSIMEventTypesName.ERROR ? bsimEvent.message : `${t('tx.confirm.BSIM.message')}...`}
            </Text>
          </View>
        </View>

        <View style={styles.btnArea}>
          <Button testID="close" size="small" square Icon={ArrowLeft} onPress={() => bottomSheetRef.current?.close()} />
          <Button testID="retry" style={styles.btnRetry} size="small" onPress={onRetry} loading={bsimEvent.type !== BSIMEventTypesName.ERROR}>
            {t('common.retry')}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
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
    marginTop: 48,
    paddingRight: 16,
  },
  bsimImg: {
    width: 60,
    height: 40,
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
  titleContainer: {
    display: 'flex',
    flexDirection: 'row',
  },
});

const snapPoints = [`${((260 / screenHeight) * 100).toFixed(2)}%`];

export default BSIMVerify;
