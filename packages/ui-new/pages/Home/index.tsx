import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Button from '@components/Button';
import Text from '@components/Text';
import Account from './Account';
import HeaderRight from './HeaderRight';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import { HomeStackName, type StackScreenProps } from '@router/configs';
import Arrow from '@assets/icons/arrow-upward.svg';
import Buy from '@assets/icons/buy.svg';
import More from '@assets/icons/more.svg';

const WalletLink: React.FC<{ title: string }> = ({ title }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.walletLink}>
      <Button square size="small" Icon={Buy} />
      <Text style={[styles.walletLinkText, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
};

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  return (
    <ScrollView>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Account onPress={() => 1} />
          <HeaderRight />
        </View>
        <CurrentAddress />
        <TotalPrice />
        <View style={styles.walletLinkContainer}>
          <WalletLink title="Send" />
          <WalletLink title="Receive" />
          <WalletLink title="Buy" />
          <WalletLink title="More" />
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLinkContainer: {
    marginTop: 32,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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