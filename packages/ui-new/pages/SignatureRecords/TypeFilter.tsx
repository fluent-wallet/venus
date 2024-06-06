import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, View, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { useTranslation } from 'react-i18next';
import FilterIcon from '@assets/icons/filter.svg';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SignatureFilterOption } from '@core/database/models/Signature/type';

const TypeFilter: React.FC<{
  onChange: (type: SignatureFilterOption) => void;
}> = ({ onChange }) => {
  const { colors, reverseColors } = useTheme();
  const [visible, setVisible] = useState(false);
  const position = useSharedValue({ right: 0, top: 0 });
  const { t } = useTranslation();

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

  const handleChange = (type: SignatureFilterOption) => {
    onChange(type);
    setVisible(false);
  }
  return (
    <View style={styles.container}>
      <View onLayout={handleLayout}>
        <Pressable onPress={() => setVisible(!visible)} testID="filter">
          <FilterIcon color={colors.textPrimary} />
        </Pressable>
      </View>
      <Modal visible={visible} onRequestClose={() => setVisible(false)} transparent animationType="none">
        <Pressable onPress={() => setVisible(!visible)} style={styles.overlay} testID="filterModal">
          <Animated.View style={[styles.options, optionStyle, { backgroundColor: reverseColors.borderThird }]}>
            <Pressable onPress={() => handleChange(SignatureFilterOption.All)} testID="all">
              <View style={styles.optionItem}>
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{t('signature.filter.all')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => handleChange(SignatureFilterOption.Transactions)} testID="tx">
              <View style={styles.optionItem}>
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{t('signature.filter.transactions')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => handleChange(SignatureFilterOption.Message)} testID="message">
              <View style={styles.optionItem}>
                <Text style={[{ color: reverseColors.textPrimary }, styles.optionItemText]}>{t('signature.filter.message')}</Text>
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

export default TypeFilter;
