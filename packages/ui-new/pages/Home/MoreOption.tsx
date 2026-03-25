import Copy from '@assets/icons/copy.svg';
import Earth from '@assets/icons/earth.svg';
import Sign from '@assets/icons/sign.svg';
import { useNavigation, useTheme } from '@react-navigation/native';
import { SignatureRecordsStackName, type StackScreenProps } from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { useCurrentNetwork } from '@service/network';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useCopyTextWithToast } from './useCopyTextWithToast';

interface MoreOptionTriggerProps {
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: VoidFunction;
  triggerRef: React.RefObject<View | null>;
}

interface MoreOptionProps {
  renderTrigger: (props: MoreOptionTriggerProps) => React.ReactNode;
}

const DEFAULT_MENU_POSITION = {
  right: 0,
  top: 0,
};

const MoreOption: React.FC<MoreOptionProps> = ({ renderTrigger }) => {
  const { reverseColors } = useTheme();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<StackScreenProps<typeof SignatureRecordsStackName>['navigation']>();

  const { data: currentAddress } = useCurrentAddress();
  const currentAddressValue = currentAddress?.value ?? null;
  const { data: currentNetwork } = useCurrentNetwork();
  const copyText = useCopyTextWithToast();
  const triggerRef = useRef<View | null>(null);
  const [visible, setVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState(DEFAULT_MENU_POSITION);

  const measureTrigger = useCallback(() => {
    triggerRef.current?.measureInWindow((pageX: number, pageY: number, width: number, height: number) => {
      setMenuPosition({
        top: pageY + height / 2,
        right: windowWidth - pageX - width,
      });
    });
  }, [windowWidth]);

  const handleTriggerLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      measureTrigger();
    },
    [measureTrigger],
  );

  const closeMenu = useCallback(() => {
    setVisible(false);
  }, []);

  const openMenu = useCallback(() => {
    measureTrigger();
    setVisible(true);
  }, [measureTrigger]);

  const toggleMenu = useCallback(() => {
    if (visible) {
      closeMenu();
      return;
    }

    openMenu();
  }, [closeMenu, openMenu, visible]);

  const handleOpenScan = useCallback(() => {
    if (!currentNetwork?.scanUrl) return;
    Linking.openURL(`${currentNetwork.scanUrl}/address/${currentAddressValue}`);
    closeMenu();
  }, [closeMenu, currentNetwork?.scanUrl, currentAddressValue]);

  const handleCopyAddress = useCallback(() => {
    copyText(currentAddressValue);
    closeMenu();
  }, [closeMenu, copyText, currentAddressValue]);

  const handleToSignatureRecords = useCallback(() => {
    navigation.navigate(SignatureRecordsStackName);
    closeMenu();
  }, [closeMenu, navigation]);

  const menuItems = useMemo(() => {
    const items = [
      {
        icon: <Copy color={reverseColors.textPrimary} />,
        key: 'copy',
        label: t('home.more.copyAddress'),
        onPress: handleCopyAddress,
      },
      {
        icon: <Sign color={reverseColors.textPrimary} />,
        key: 'signatureRecords',
        label: t('home.more.signatureRecords'),
        onPress: handleToSignatureRecords,
      },
    ];

    if (currentNetwork?.scanUrl) {
      items.unshift({
        icon: <Earth color={reverseColors.textPrimary} />,
        key: 'view',
        label: t('home.more.viewOnExplorer'),
        onPress: handleOpenScan,
      });
    }

    return items;
  }, [currentNetwork?.scanUrl, handleCopyAddress, handleOpenScan, handleToSignatureRecords, reverseColors.textPrimary, t]);

  return (
    <>
      {renderTrigger({ onLayout: handleTriggerLayout, onPress: toggleMenu, triggerRef })}
      <Modal visible={visible} onRequestClose={closeMenu} transparent animationType="none">
        <Pressable onPress={closeMenu} style={styles.overlay} testID="more">
          <View style={[styles.options, menuPosition, { backgroundColor: reverseColors.borderThird }]}>
            {menuItems.map((item) => (
              <Pressable key={item.key} onPress={item.onPress} testID={item.key}>
                <View style={styles.optionItem}>
                  <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{item.label}</Text>
                  {item.icon}
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
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
