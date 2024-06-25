import Icon from '@components/Icon';
import Spinner from '@components/Spinner';
import { WalletConnectMetadata } from '@core/WalletCore/Plugins/WalletConnect/types';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { useCallback, useState } from 'react';
import { AssetType, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { ParseTxDataReturnType, isApproveMethod } from '@utils/parseTxData';
import ModifyIcon from '@assets/icons/modify.svg';
import { TxDataWithTokenInfo } from '.';
import { formatUnits, parseUnits } from 'ethers';

interface IProps {
  metadata: WalletConnectMetadata;
  to?: string;
  data?: string;
  parseData?: TxDataWithTokenInfo;
  openEditAllowance?: () => void;
  customAllowance?: string;
}

function Contract({
  to,
  parseData,
  metadata: { icons, name },
  openEditAllowance: openModifyModal = () => {
    //
  },
  customAllowance,
}: IProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const currentNetwork = useCurrentNetwork();

  const getFormatValue = useCallback(
    (value: bigint | string) => {
      if (parseData && parseData.decimals) {
        return formatUnits(value, parseData.decimals);
      } else {
        return value.toString();
      }
    },
    [parseData],
  );

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.dappInfo}>
        {icons[0] && <Icon source={icons[0]} width={32} height={32} style={{ borderRadius: 8 }} />}
        <View>
          <Text style={[styles.txReq, { color: colors.textSecondary }]}>{t('wc.dapp.tx.transactionRequest')}</Text>
          <Text style={[styles.dappName, { color: colors.textPrimary }]}>{name}</Text>
        </View>
      </View>

      <View style={styles.mTop24}>
        {parseData && isApproveMethod(parseData) && parseData.decimals ? (
          <View>
            <View>
              <Text style={[styles.font16, { color: colors.textPrimary }]}>{t('wc.dapp.tx.simulatedResult')}</Text>
            </View>
            <Pressable testID="edit" style={[styles.mTop16, styles.flexWithRow]} onPress={openModifyModal}>
              <Text style={[styles.font22, { color: colors.textPrimary, textTransform: 'capitalize' }]}>{parseData.functionName}</Text>
              <Text style={[styles.font22, styles.value, { color: parseData.isUnlimited ? colors.textNotice : colors.textPrimary }]} numberOfLines={1}>
                {customAllowance ? customAllowance.toString() : parseData.isUnlimited ? t('wc.dapp.tx.unlimited') : getFormatValue(parseData.value)}
              </Text>
              {parseData.symbol && <Text style={styles.font22}>{parseData.symbol}</Text>}
              {parseData && isApproveMethod(parseData) && parseData.assetType === AssetType.ERC20 ? <ModifyIcon width={24} height={24} /> : null}
            </Pressable>
          </View>
        ) : (
          <View>
            <View>
              <Text style={[styles.font16, { color: colors.textPrimary }]}>{t('wc.dapp.tx.contractInteraction')}</Text>
            </View>
            <View>
              <Text style={[styles.font14, { color: colors.textPrimary }]}>{t('wc.dapp.tx.unableSimulated')}</Text>
            </View>
          </View>
        )}
      </View>

      {!parseData ? (
        <View style={[styles.infoBox, styles.flexWithRow, styles.mTop24, { borderColor: colors.borderPrimary }]}>
          <Spinner color={colors.iconPrimary} width={24} height={24} />
          <Text style={[styles.font14, { color: colors.textPrimary }]}>{t('wc.dapp.tx.simulating')}...</Text>
        </View>
      ) : (
        <View style={[styles.infoBox, styles.mTop24, { borderColor: colors.borderFourth }]}>
          <Pressable testID="expand" onPress={() => setExpanded(!expanded)}>
            <View style={styles.flexWithRow}>
              <Text style={[styles.font14, { color: colors.textPrimary }]}>{t('wc.dapp.tx.viewData')}</Text>
              <ArrowLeft style={[{ transform: [{ rotate: expanded ? '-90deg' : '-180deg' }] }]} color={colors.textPrimary} width={14} height={14} />
            </View>
          </Pressable>
          {expanded && (
            <View>
              {to && (
                <View style={[styles.detailItem, styles.mTop16]}>
                  <Text style={[styles.font14, { color: colors.textSecondary }]}>{t('wc.dapp.tx.contract')}</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{to ? to : ''}</Text>
                </View>
              )}
              <View style={[styles.detailItem, styles.mTop16]}>
                <Text style={[styles.font14, { color: colors.textSecondary }]}>{t('wc.dapp.tx.function')}</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{parseData.functionName || t('wc.dapp.tx.unknown')}</Text>
              </View>
              <View style={[styles.detailItem, styles.mTop16]}>
                <Text style={[styles.font14, { color: colors.textSecondary }]}>{t('wc.dapp.tx.network')}</Text>
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
  font14: {
    fontSize: 14,
    fontWeight: '300',
  },
  font16: {
    fontSize: 16,
    fontWeight: '600',
  },
  font22: {
    fontSize: 22,
    fontWeight: '600',
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
  },
  mTop16: {
    marginTop: 16,
  },
  mTop24: {
    marginTop: 24,
  },
  value: {
    flex: 1,
    textDecorationLine: 'underline',
    textAlign: 'right',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});
export default Contract;
