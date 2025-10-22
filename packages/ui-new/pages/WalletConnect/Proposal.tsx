import ArrowRight from '@assets/icons/arrow-right2.svg';
import { snapPoints, BottomSheetWrapper, BottomSheetScrollContent, BottomSheetFooter, BottomSheetRoute } from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import Text from '@components/Text';
import plugins from '@core/WalletCore/Plugins';
import { useCurrentAccount, useCurrentAddressOfAccount, useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import type { IWCSessionProposalEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import { shortenAddress } from '@core/utils/address';
import useInAsync from '@hooks/useInAsync';
import AccountSelector from '@modules/AccountSelector';
import { type RouteProp, useRoute, useTheme } from '@react-navigation/native';
import type { WalletConnectParamList, WalletConnectProposalStackName } from '@router/configs';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

export default function WalletConnectProposal() {
  const route = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectProposalStackName>>();
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const {
    metadata: { name = '', description = '', url = '', icons = [] },
    connectedNetworks,
  } = route.params;
  const { colors } = useTheme();
  const { t } = useTranslation();

  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddressOfAccount(currentAccount?.id);
  const currentAddressValue = useCurrentAddressValue();

  const isHTTPS = url.startsWith('https://');

  const _handleApprove = useCallback(async () => {
    try {
      const approve = plugins.WalletConnect.currentEventSubject.getValue()?.action.approve as IWCSessionProposalEvent['action']['approve'];
      await approve();
    } catch (e) {
      console.log(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAddress?.id]);

  const _handleReject = useCallback(async () => {
    try {
      await plugins.WalletConnect.currentEventSubject.getValue()?.action.reject();
    } catch (err) {
      console.log('errr', err);
    }
  }, []);

  const { inAsync: inApproving, execAsync: handleApprove } = useInAsync(_handleApprove);
  const { inAsync: inRejecting, execAsync: handleReject } = useInAsync(_handleReject);

  return (
    <>
      <BottomSheetRoute
        enablePanDownToClose={!inApproving}
        enableContentPanningGesture={!inApproving}
        snapPoints={snapPoints.large}
        onClose={() => handleReject()}
      >
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetScrollContent>
            <View style={styles.info}>
              <Image source={icons[0]} style={styles.icon} />
              <Text style={[styles.textStrong, styles.name, { color: colors.textPrimary }]}>{name}</Text>
              <Text style={[styles.describe, { color: colors.textPrimary }]}>{t('wc.proposal.describe')}</Text>
              <View style={styles.url}>
                {!isHTTPS ? <Text style={[styles.urlWarning, { borderColor: colors.down, color: colors.down }]}>{t('common.unsafe')}</Text> : null}
                <Text style={{ color: isHTTPS ? colors.up : colors.down, textDecorationLine: isHTTPS ? 'none' : 'underline' }}>{url}</Text>
              </View>
            </View>
            <Pressable onPress={() => setShowAccountSelector(true)} testID="account">
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('wc.proposal.accountSelected')}</Text>
                <View style={[styles.account, { borderColor: colors.borderFourth }]}>
                  <Text style={[styles.textStrong, { color: colors.textPrimary, marginRight: 4 }]}>
                    {currentAccount?.nickname}
                    {`(${shortenAddress(currentAddressValue)})`}
                  </Text>
                  <ArrowRight color={colors.textPrimary} width={16} height={16} />
                </View>
              </View>
            </Pressable>
            <View style={styles.networkWarp}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('common.network')}</Text>
              <View style={styles.network}>
                {connectedNetworks.map((network) => (
                  <Icon source={network.icon} width={22} height={22} style={{ borderRadius: 11 }} key={network.id} />
                ))}
                {connectedNetworks.length === 1 && <Text style={{ color: colors.textPrimary }}>{connectedNetworks[0]?.name}</Text>}
              </View>
            </View>
          </BottomSheetScrollContent>
          <BottomSheetFooter>
            <View style={styles.btnArea}>
              <Button
                style={[styles.btn, { backgroundColor: isHTTPS ? undefined : colors.down }]}
                onPress={handleReject}
                testID="reject"
                disabled={inRejecting}
                loading={inRejecting}
              >
                {t('common.cancel')}
              </Button>
              <Button style={styles.btn} onPress={handleApprove} testID="approve" disabled={inApproving} loading={inApproving}>
                {t('common.connect')}
              </Button>
            </View>
          </BottomSheetFooter>
        </BottomSheetWrapper>
      </BottomSheetRoute>
      <AccountSelector isOpen={showAccountSelector} onClose={() => setShowAccountSelector(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  info: {
    marginTop: 80,
    display: 'flex',
    alignItems: 'center',
  },
  textStrong: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  name: {
    marginTop: 16,
  },
  describe: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 16,
  },
  url: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 60,
    gap: 8,
  },
  urlWarning: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  icon: {
    width: 61,
    height: 61,
    borderRadius: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 16,
  },
  account: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 6,
  },
  networkWarp: {
    marginTop: 16,
  },
  network: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
  },
  networkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});
