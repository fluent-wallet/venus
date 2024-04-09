import { NetworkType, useCurrentAddress, useCurrentAddressValue, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useTheme } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, Modal, Pressable, Dimensions, Linking } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Copy from '@assets/icons/copy.svg';
import Earth from '@assets/icons/earth.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { showMessage } from 'react-native-flash-message';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
const MoreOption: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { reverseColors } = useTheme();
  const currentAddressValue = useCurrentAddressValue();
  const currentNetwork = useCurrentNetwork();
  const [visible, setVisible] = useState(false);
  const position = useSharedValue({ right: 0, top: 0 });

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        position.value = {
          top: pageY + height / 2,
          right: Dimensions.get('window').width - pageX - width,
        };
      });
    },
    [position],
  );

  const optionStyle = useAnimatedStyle(() => {
    return {
      top: position.value.top,
      right: position.value.right,
    };
  });

  const handleOpenScan = useCallback(() => {
    if (currentNetwork?.networkType === NetworkType.Ethereum) {
      if (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID) {
        Linking.openURL(`https://evm.confluxscan.io/address/${currentAddressValue}`);
      } else if (currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID) {
        Linking.openURL(`https://evmtestnet.confluxscan.io/address/${currentAddressValue}`);
      } else {
        Linking.openURL(currentNetwork?.scanUrl ?? '');
      }
    } else {
      Linking.openURL(currentNetwork?.scanUrl ?? '');
    }
    setVisible(false);
  }, [currentNetwork?.scanUrl, currentNetwork?.chainId, currentNetwork?.networkType, currentAddressValue]);

  const handleCoy = useCallback(() => {
    Clipboard.setString(currentAddressValue ?? '');
    showMessage({
      message: 'Copied!',
      type: 'success',
      duration: 1500,
    });
    setVisible(false);
  }, [currentAddressValue]);

  return (
    <View style={styles.container}>
      <View onLayout={handleLayout}>{React.cloneElement(children, { onPress: () => setVisible(!visible) })}</View>
      <Modal visible={visible} onRequestClose={() => setVisible(false)} transparent animationType="none">
        <Pressable onPress={() => setVisible(!visible)} style={styles.overlay} testID="more">
          <Animated.View style={[styles.options, optionStyle, { backgroundColor: reverseColors.borderThird }]}>
            <Pressable onPress={handleOpenScan} testID="">
              <View style={styles.optionItem} testID="view">
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>View in explorer</Text>
                <Earth color={reverseColors.textPrimary} width={22} height={22} />
              </View>
            </Pressable>
            <Pressable onPress={handleCoy} testID="copy">
              <View style={styles.optionItem}>
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>Copy address</Text>
                <Copy color={reverseColors.textPrimary} width={20} height={20} />
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  options: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  optionItem: {
    width: 200,
    height: 45,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionItemText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
  },
});

export default MoreOption;
