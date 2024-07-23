import ESpaceMainnet from '@assets/chains/eSpace-mainnet.svg';
import QrCode from '@assets/icons/qr-code.svg';
import Settings from '@assets/icons/settings.svg';
import Text from '@components/Text';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useTheme } from '@react-navigation/native';
import { type HomeStackName, ExternalInputHandlerStackName, SettingsStackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const Network: React.FC = () => {
  const { colors } = useTheme();
  const currentNetwork = useCurrentNetwork();

  if (!currentNetwork) return null;
  if (currentNetwork.netId === 1030) return <ESpaceMainnet />;
  return (
    <Text style={[styles.networkText, { color: colors.textPrimary }]} numberOfLines={3}>
      {currentNetwork.name}
    </Text>
  );
};

const HeaderRight: React.FC<{ navigation: StackScreenProps<typeof HomeStackName>['navigation']; onPressNetwork: () => void }> = ({
  navigation,
  onPressNetwork,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.wrapper,
          styles.wrapperLeft,
          { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' },
        ]}
        onPress={onPressNetwork}
        testID="network"
      >
        <Network />
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.wrapper, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => navigation.navigate(ExternalInputHandlerStackName)}
        testID="scanQRCode"
      >
        <QrCode color={colors.textSecondary} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.wrapper,
          styles.wrapperRight,
          { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' },
        ]}
        onPress={() => navigation.navigate(SettingsStackName)}
        testID="settings"
      >
        <Settings color={colors.textSecondary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderWidth: 1,
  },
  wrapperLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  wrapperRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  networkText: {
    fontSize: 8,
    fontWeight: '300',
  },
});

export default HeaderRight;
