import Copy from '@assets/icons/copy.svg';
import Earth from '@assets/icons/earth.svg';
import Sign from '@assets/icons/sign.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation, useTheme } from '@react-navigation/native';
import { SignatureRecordsStackName, type StackScreenProps } from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { useCurrentNetwork } from '@service/network';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, type LayoutChangeEvent, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const MoreOption: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { reverseColors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof SignatureRecordsStackName>['navigation']>();

  const { data: currentAddress } = useCurrentAddress();
  const currentAddressValue = currentAddress?.value ?? null;
  const { data: currentNetwork } = useCurrentNetwork();
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
    if (!currentNetwork?.scanUrl) return;
    Linking.openURL(`${currentNetwork.scanUrl}/address/${currentAddressValue}`);
    setVisible(false);
  }, [currentNetwork?.scanUrl, currentAddressValue]);

  const handleCoy = useCallback(() => {
    Clipboard.setString(currentAddressValue ?? '');
    showMessage({
      message: t('common.copied'),
      type: 'success',
      duration: 1500,
      width: 160,
    });
    setVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAddressValue]);

  const handleToSignatureRecords = useCallback(() => {
    navigation.navigate(SignatureRecordsStackName);
    setVisible(false);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View onLayout={handleLayout}>{React.cloneElement(children, { onPress: () => setVisible(!visible) })}</View>
      <Modal visible={visible} onRequestClose={() => setVisible(false)} transparent animationType="none">
        <Pressable onPress={() => setVisible(!visible)} style={styles.overlay} testID="more">
          <Animated.View style={[styles.options, optionStyle, { backgroundColor: reverseColors.borderThird }]}>
            {currentNetwork?.scanUrl && (
              <Pressable onPress={handleOpenScan} testID="view">
                <View style={styles.optionItem}>
                  <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{t('home.more.viewOnExplorer')}</Text>
                  <Earth color={reverseColors.textPrimary} />
                </View>
              </Pressable>
            )}
            <Pressable onPress={handleCoy} testID="copy">
              <View style={styles.optionItem}>
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{t('home.more.copyAddress')}</Text>
                <Copy color={reverseColors.textPrimary} />
              </View>
            </Pressable>
            <Pressable onPress={handleToSignatureRecords} testID="signatureRecords">
              <View style={styles.optionItem}>
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{t('home.more.signatureRecords')}</Text>
                <Sign color={reverseColors.textPrimary} />
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
