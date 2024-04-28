import BottomSheet, { snapPoints } from '@components/BottomSheet';
import { Image } from 'expo-image';
import { RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import { WalletConnectParamList, WalletConnectProposalStackName, WalletConnectStackName } from '@router/configs';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/Text';
import { useTranslation } from 'react-i18next';
import Button from '@components/Button';
import { useCurrentAccount, useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { useCallback, useState } from 'react';
import AccountSelector from '@modules/AccountSelector';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { SvgUri } from 'react-native-svg';

export default function WalletConnectProposal() {
  const route = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectProposalStackName>>();
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddress();
  const currentNetwork = useCurrentNetwork();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const {
    metadata: { name = '', description = '', url = '', icons = [] },
    approve,
    reject,
  } = route.params;

  const icon = icons[0];
  const isHTTPS = url.startsWith('https://');
  const handleReject = useCallback(async () => {
    try {
      await reject();
      navigation.goBack();
    } catch (e) {
      // TODO handle error
      console.log(e);
    }
  }, [reject, navigation]);

  const handleApprove = useCallback(async () => {
    try {
      await approve({
        eip155: {
          chains: [`eip155:${currentNetwork?.netId}`],
          methods: [],
          events: [],
          accounts: [`eip155:${currentNetwork?.netId}:${currentAddress?.hex}`],
        },
      });
      navigation.goBack();
    } catch (e) {
      // TODO handle error
      console.log(e);
    }
  }, [approve, currentAddress?.hex, currentNetwork?.netId, navigation]);

  return (
    <>
      <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75}>
        <View style={styles.container}>
          <View style={styles.info}>
            <Image source={icon} style={styles.icon} />
            <Text style={[styles.textStrong, styles.name, { color: colors.textPrimary }]}>{name}</Text>
            <Text style={styles.describe}>{t('wc.proposal.describe')}</Text>
            <View style={styles.url}>
              {!isHTTPS ? <Text>{t('common.unsafe')}</Text> : null}
              <Text style={{ color: isHTTPS ? colors.up : colors.down }}>{url}</Text>
            </View>
          </View>
          <Pressable onPress={() => setShowAccountSelector(true)}>
            <View>
              <Text style={styles.label}>{t('wc.proposal.accountSelected')}</Text>
              <View style={[styles.account, { borderColor: colors.borderFourth }]}>
                <Text style={[styles.textStrong, { color: colors.textPrimary }]}>
                  {currentAccount?.nickname}
                  {`(${shortenAddress(currentAddress?.hex)})`}
                </Text>
              </View>
            </View>
          </Pressable>
          <View style={styles.networkWarp}>
            <Text style={styles.label}>{t('common.network')}</Text>
            <View style={styles.network}>
              <SvgUri uri={currentNetwork?.icon || ''} width={22} height={22} />
              <Text>{currentNetwork?.name}</Text>
            </View>
          </View>

          <View style={styles.buttons}>
            <Button style={[styles.button, { backgroundColor: colors.down }]} onPress={handleReject}>
              {t('common.cancel')}
            </Button>
            <Button style={styles.button} onPress={handleApprove}>
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
    marginBottom: 60,
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
