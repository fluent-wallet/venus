import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { type MessageOptions, type Message as _Message } from 'react-native-flash-message';
import Animated, { withTiming, useSharedValue, Easing } from 'react-native-reanimated';
import { useTheme } from '@react-navigation/native';
import { screenWidth } from '../../utils/deviceInfo';
import Success from '../../assets/icons/message-success.svg';
import Fail from '../../assets/icons/message-fail.svg';
import Warning from '../../assets/icons/message-warning.svg';

const iconSourceMap = {
  success: Success,
  failed: Fail,
  warning: Warning,
};

type Message = Omit<_Message, 'type'> & { type: keyof typeof iconSourceMap; width?: number | 'full' };

declare module 'react-native-flash-message' {
  export function showMessage(params: Omit<MessageOptions, 'type'> & { type: keyof typeof iconSourceMap; width?: number | 'full' }): void;
}

const fullMessageWidth = screenWidth - 32;
const CustomMessage: React.FC<{ message: Message; style?: StyleProp<ViewStyle> }> = ({ style, message: { type, message, description, duration, width } }) => {
  const { reverseColors } = useTheme();
  const messageWidth = !width || width === 'full' ? fullMessageWidth : width;
  const translateX = useSharedValue(-messageWidth);
  const opacity = useSharedValue(100);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: (duration ?? 3000) + 225, easing: Easing.linear }, () => {
      opacity.value = withTiming(0, { duration: 225 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressBg = useMemo(() => (type === 'success' ? '#01C2E1' : '#FD6464'), [type]);

  const Icon = useMemo(() => iconSourceMap[type], [type]);
  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: reverseColors.bgSecondary,
          width: messageWidth,
          justifyContent: !width || width === 'full' ? 'flex-start' : 'center',
        },
        style,
      ]}
    >
      {type && <Icon style={styles.icon} color={reverseColors.textPrimary} />}
      <View style={styles.textArea}>
        {message && <Text style={[styles.title, { color: reverseColors.textPrimary }]}>{message}</Text>}

        {description && <Text style={[styles.description, { color: reverseColors.textPrimary }]}>{description}</Text>}
      </View>

      <Animated.View style={[styles.duration, { transform: [{ translateX }], opacity, backgroundColor: progressBg, width: messageWidth }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    alignSelf: 'center',
    padding: 16,
    borderRadius: 6,
    overflow: 'hidden',
  },
  icon: {
    flexShrink: 0,
    width: 24,
    height: 24,
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  textArea: {
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    fontWeight: '300',
    marginTop: 8,
  },
  duration: {
    position: 'absolute',
    height: 4,
    backgroundColor: 'red',
    bottom: 0,
    left: 0,
  },
});

export default CustomMessage;
