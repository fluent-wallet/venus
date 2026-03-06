import ArrowRight from '@assets/icons/arrow-right2.svg';
import { BottomSheetFooter, BottomSheetRoute, BottomSheetScrollContent, BottomSheetWrapper, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import Text from '@components/Text';
import { shortenAddress } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import useInAsync from '@hooks/useInAsync';
import AccountSelector from '@modules/AccountSelector';
import { type RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import type { WalletConnectParamList, WalletConnectProposalStackName } from '@router/configs';
import { useCurrentAccount } from '@service/account';
import { getExternalRequestsService, getRuntimeConfig } from '@service/core';
import { useNetworks } from '@service/network';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

const extractEip155Chains = (requiredNamespaces: unknown, optionalNamespaces: unknown): string[] => {
  const chains = new Set<string>();

  const collectFromNamespaces = (namespaces: unknown) => {
    if (!namespaces || typeof namespaces !== 'object') return;
    for (const [key, value] of Object.entries(namespaces as Record<string, unknown>)) {
      if (!key.startsWith('eip155')) continue;

      if (key.includes(':')) {
        chains.add(key);
        continue;
      }

      if (!value || typeof value !== 'object') continue;
      const list = (value as { chains?: unknown }).chains;
      if (Array.isArray(list)) {
        for (const item of list) {
          if (typeof item === 'string' && item.startsWith('eip155:')) chains.add(item);
        }
      }
    }
  };

  collectFromNamespaces(requiredNamespaces);
  collectFromNamespaces(optionalNamespaces);

  return Array.from(chains);
};

export default function WalletConnectProposal() {
  const route = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectProposalStackName>>();
  const navigation = useNavigation();
  const params = route.params as WalletConnectParamList[typeof WalletConnectProposalStackName];

  const { requestId: runtimeRequestId, request: runtimeRequest } = params;

  const [showAccountSelector, setShowAccountSelector] = useState(false);

  const metadata = runtimeRequest?.metadata ?? {};

  const name = typeof metadata?.name === 'string' ? metadata.name : '';
  const description = typeof metadata?.description === 'string' ? metadata.description : '';
  const url = typeof metadata?.url === 'string' && metadata.url ? metadata.url : (runtimeRequest?.origin ?? '');
  const icons = Array.isArray(metadata?.icons) ? (metadata.icons as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  const networksQuery = useNetworks();
  const networks = networksQuery.data ?? [];

  const allowedEip155Chains = getRuntimeConfig().walletConnect?.allowedEip155Chains ?? null;
  const requestedChains = extractEip155Chains(runtimeRequest?.requiredNamespaces, runtimeRequest?.optionalNamespaces);
  const displayChains =
    Array.isArray(allowedEip155Chains) && allowedEip155Chains.length > 0 ? requestedChains.filter((c) => allowedEip155Chains.includes(c)) : requestedChains;

  const connectedNetworks = networks
    .filter((n) => n.networkType === NetworkType.Ethereum && displayChains.includes(`eip155:${n.netId}`))
    .map((n) => ({ icon: n.icon ?? '', name: n.name, netId: n.netId, id: n.id, networkType: n.networkType }));

  const { colors } = useTheme();
  const { t } = useTranslation();

  const { data: currentAccount } = useCurrentAccount();
  const currentAddressValue = currentAccount?.address ?? '';

  const isHTTPS = url.startsWith('https://');

  const _handleApprove = useCallback(async () => {
    try {
      try {
        getExternalRequestsService().approve({ requestId: runtimeRequestId });
      } catch (error) {
        console.log(error);
      } finally {
        if (navigation.canGoBack()) navigation.goBack();
      }
    } catch (e) {
      console.log(e);
    }
  }, [navigation, runtimeRequestId]);

  const _handleReject = useCallback(async () => {
    try {
      try {
        getExternalRequestsService().reject({ requestId: runtimeRequestId });
      } catch (error) {
        console.log(error);
      } finally {
        if (navigation.canGoBack()) navigation.goBack();
      }
    } catch (err) {
      console.log('errr', err);
    }
  }, [navigation, runtimeRequestId]);

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
                {connectedNetworks.map((network: any) => (
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
      {showAccountSelector && <AccountSelector isOpen={showAccountSelector} onClose={() => setShowAccountSelector(false)} />}
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
