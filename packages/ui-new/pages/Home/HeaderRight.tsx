import QrCode from '@assets/icons/qr-code.svg';
import Settings from '@assets/icons/settings.svg';
import Icon from '@components/Icon';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { ExternalInputHandlerStackName, type HomeStackName, SettingsStackName, type StackScreenProps } from '@router/configs';
import { useCurrentNetwork } from '@service/network';
import { getNetworkTag } from '@utils/networkSelection';
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const Network: React.FC = () => {
  const { data: currentNetwork } = useCurrentNetwork();
  const { colors } = useTheme();
  if (!currentNetwork) return null;

  const tag = getNetworkTag(currentNetwork);

  return (
    <>
      <Icon source={currentNetwork.icon} width={24} height={24} />
      {tag && (
        <View style={[styles.networkTag, { backgroundColor: tag.color }]}>
          <Text style={[styles.networkTagText, { color: colors.textFourth }]} numberOfLines={1} ellipsizeMode="tail">
            {tag.label}
          </Text>
        </View>
      )}
    </>
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
    position: 'relative',
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
  networkTag: {
    position: 'absolute',
    bottom: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    maxWidth: 32,
    overflow: 'hidden',
  },
  networkTagText: {
    fontSize: 6,
    lineHeight: 8,
  },
});

export default HeaderRight;
