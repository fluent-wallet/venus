import React, { useRef, type ComponentProps } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import methods from '@core/WalletCore/Methods';
import { getCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentNetwork';
import Button from '@components/Button';
import Text from '@components/Text';
import { HomeStackName, type StackScreenProps } from '@router/configs';
import { isProd } from '@utils/getEnv';
import ArrowUpward from '@assets/icons/arrow-upward.svg';
import ArrowDownward from '@assets/icons/arrow-downward.svg';
import Buy from '@assets/icons/buy.svg';
import More from '@assets/icons/more.svg';
import Account from './Account';
import AccountSelector, { type BottomSheetMethods } from './AccountSelector';
import NetworkSelector from './NetworkSelector';
import HeaderRight from './HeaderRight';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import Tabs from './Tabs';

const WalletLink: React.FC<{ title: string; Icon: ComponentProps<typeof Button>['Icon'] }> = ({ title, Icon }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.walletLink}>
      <Button square size="small" Icon={Icon} />
      <Text style={[styles.walletLinkText, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
};

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  const accountSelectorRef = useRef<BottomSheetMethods>(null!);
  const networkSelectorRef = useRef<BottomSheetMethods>(null!);

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Account onPress={() => accountSelectorRef.current?.expand()} />
          <HeaderRight
            navigation={navigation}
            onPressNetwork={() => {
              if (isProd) {
                const currentNetwork = getCurrentNetwork();
                methods.switchToNetwork(currentNetwork?.netId === 1030 ? 71 : 1030);
              } else {
                networkSelectorRef.current?.expand();
              }
            }}
          />
        </View>
        <CurrentAddress />
        <TotalPrice />
        <View style={styles.walletLinkContainer}>
          <WalletLink title="Send" Icon={ArrowUpward} />
          <WalletLink title="Receive" Icon={ArrowDownward} />
          <WalletLink title="Buy" Icon={Buy} />
          <WalletLink title="More" Icon={More} />
        </View>
        <Tabs />
      </SafeAreaView>
      <AccountSelector selectorRef={accountSelectorRef} />
      <NetworkSelector selectorRef={networkSelectorRef} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 16,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  walletLinkContainer: {
    marginTop: 32,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  walletLink: {
    flex: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  walletLinkText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
});

export default Home;
