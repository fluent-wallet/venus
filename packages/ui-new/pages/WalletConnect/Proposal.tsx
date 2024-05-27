import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RouteProp, useRoute, useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useCurrentAccount, useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { type IWCSessionProposalEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import plugins from '@core/WalletCore/Plugins';
import AccountSelector from '@modules/AccountSelector';
import Text from '@components/Text';
import BottomSheet, { snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import useInAsync from '@hooks/useInAsync';
import { WalletConnectParamList, WalletConnectProposalStackName } from '@router/configs';

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
  const currentAddressValue = useCurrentAddressValue();

  const isHTTPS = url.startsWith('https://');

  const _handleApprove = useCallback(async () => {
    try {
      const approve = plugins.WalletConnect.currentEventSubject.getValue()?.action.approve as IWCSessionProposalEvent['action']['approve'];
      await approve({
        chains: connectedNetworks.map((net) => `eip155:${net.netId}`),
        accounts: connectedNetworks.map((net) => `eip155:${net.netId}:${currentAddressValue}`), //[`eip155:${currentNetwork?.netId}:${currentAddress?.hex}`],
      });
    } catch (e) {
      console.log(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAddressValue]);

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
      <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75} onClose={() => handleReject()}>
        <View style={styles.container}>
          <View style={styles.info}>
            <Image source={icons[0]} style={styles.icon} />
            <Text style={[styles.textStrong, styles.name, { color: colors.textPrimary }]}>{name}</Text>
            <Text style={styles.describe}>{t('wc.proposal.describe')}</Text>
            <View style={styles.url}>
              {!isHTTPS ? <Text style={[styles.urlWarning, { borderColor: colors.down, color: colors.down }]}>{t('common.unsafe')}</Text> : null}
              <Text style={{ color: isHTTPS ? colors.up : colors.down, textDecorationLine: isHTTPS ? 'none' : 'underline' }}>{url}</Text>
            </View>
          </View>
          <Pressable onPress={() => setShowAccountSelector(true)} testID="account">
            <View>
              <Text style={styles.label}>{t('wc.proposal.accountSelected')}</Text>
              <View style={[styles.account, { borderColor: colors.borderFourth }]}>
                <Text style={[styles.textStrong, { color: colors.textPrimary }]}>
                  {currentAccount?.nickname}
                  {`(${shortenAddress(currentAddressValue)})`}
                </Text>
              </View>
            </View>
          </Pressable>
          <View style={styles.networkWarp}>
            <Text style={styles.label}>{t('common.network')}</Text>
            <View style={styles.network}>
              {connectedNetworks.map((network) => (
                <Icon source={network.icon} width={22} height={22} style={{ borderRadius: 11 }} key={network.id} />
              ))}
              {connectedNetworks.length === 1 && <Text>{connectedNetworks[0]?.name}</Text>}
            </View>
          </View>

          <View style={styles.buttons}>
            <Button
              style={[styles.button, { backgroundColor: isHTTPS ? undefined : colors.down }]}
              onPress={handleReject}
              testID="reject"
              disabled={inRejecting}
              loading={inRejecting}
            >
              {t('common.cancel')}
            </Button>
            <Button style={styles.button} onPress={handleApprove} testID="approve" disabled={inApproving} loading={inApproving}>
              {t('common.connect')}
            </Button>
          </View>
        </View>
      </BottomSheet>
      {showAccountSelector && <AccountSelector onClose={() => setShowAccountSelector(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  info: {
    marginTop: 80,
    display: 'flex',
    alignItems: 'center',
  },
  textStrong: {
    fontSize: 16,
    fontWeight: '600',
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
  buttons: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 40,
  },
  button: {
    flex: 1,
  },
});
