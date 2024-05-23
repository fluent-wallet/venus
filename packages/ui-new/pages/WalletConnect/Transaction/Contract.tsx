import Icon from '@components/Icon';
import Spinner from '@components/Spinner';
import { WalletConnectMetadata } from '@core/WalletCore/Plugins/WalletConnect/types';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { useParseTxData } from '@hooks/useParseTxData';
import { useState } from 'react';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';

interface IProps {
  metadata: WalletConnectMetadata;
  to?: string;
  data?: string;
}

function Contract({ to, data, metadata: { icons, name } }: IProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const currentNetwork = useCurrentNetwork();

  const { isPadding, isSuccess, error, methodName } = useParseTxData({ to, data });
  return (
    <View>
      <View style={styles.dappInfo}>
        {icons[0] && <Icon source={icons[0]} width={32} height={32} style={{ borderRadius: 8 }} />}
        <View>
          <Text style={[styles.txReq, { color: colors.textSecondary }]}>{t('wc.dapp.tx.transactionRequest')}</Text>
          <Text style={[styles.dappName, { color: colors.textPrimary }]}>{name}</Text>
        </View>
      </View>

      {isPadding ? (
        <View style={[styles.infoBox, styles.flexWithRow, { borderColor: colors.borderPrimary }]}>
          <Spinner color={colors.iconPrimary} width={24} height={24} />
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('wc.dapp.tx.simulating')}...</Text>
        </View>
      ) : (
        <View style={[styles.infoBox, { borderColor: colors.borderFourth }]}>
          <Pressable onPress={() => setExpanded(!expanded)}>
            <View style={styles.flexWithRow}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{t('wc.dapp.tx.viewData')}</Text>
              <ArrowLeft style={[{ transform: [{ rotate: expanded ? '-90deg' : '-180deg' }] }]} color={colors.textPrimary} width={14} height={14} />
            </View>
          </Pressable>
          {expanded && !isPadding && (
            <View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailName, { color: colors.textSecondary }]}>{t('wc.dapp.tx.contract')}</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{to ? to : ''}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailName, { color: colors.textSecondary }]}>{t('wc.dapp.tx.function')}</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{isSuccess ? methodName : t('wc.daap.tx.unknown')}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailName, { color: colors.textSecondary }]}>{t('wc.dapp.tx.network')}</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{currentNetwork?.name}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dappInfo: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  txReq: {
    fontSize: 12,
    fontWeight: '300',
  },
  dappName: {
    fontSize: 14,
    fontWeight: '600',
  },
  flexWithRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  infoBox: {
    borderWidth: 1,
    borderRadius: 6,

    padding: 16,
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '300',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
  },
  detailName: {
    fontSize: 14,
    fontWeight: '300',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right'
  },
});
export default Contract;
