import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { type MessageOptions, type Message as _Message } from 'react-native-flash-message';
import Animated, { withTiming, useSharedValue, Easing } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useTheme } from '@react-navigation/native';
import { screenWidth } from '../../utils/deviceInfo';
import Success from '../../assets/icons/message-success.webp';
import Fail from '../../assets/icons/message-fail.webp';
import Warning from '../../assets/icons/message-warning.webp';
import NoNetwork from '../../assets/icons/message-network.webp';
import Loading from '../../assets/icons/message-loading.webp';

const iconSourceMap = {
  success: Success,
  failed: Fail,
  warning: Warning,
  noNetwork: NoNetwork,
  loading: Loading,
};

type Message = Omit<_Message, 'type'> & { type: keyof typeof iconSourceMap };

declare module 'react-native-flash-message' {
  export function showMessage(params: Omit<MessageOptions, 'type'> & { type: keyof typeof iconSourceMap }): void;
}

const messageWidth = screenWidth - 32;
const CustomMessage: React.FC<{ message: Message; style?: StyleProp<ViewStyle> }> = ({ style, message: { type, message, description, duration } }) => {
  const { colors } = useTheme();
  const translateX = useSharedValue(-messageWidth);
  const opacity = useSharedValue(100);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: (duration ?? 3000) + 225, easing: Easing.linear }, () => {
      opacity.value = withTiming(0, { duration: 225 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressBg = useMemo(() => (type === 'success' || type === 'loading' ? '#01C2E1' : '#FD6464'), [type]);

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bgSecondary }, style]}>
      {type && iconSourceMap[type] && <Image style={styles.icon} source={iconSourceMap[type]} contentFit="contain" />}

      <View style={styles.textArea}>
        {message && <Text style={[styles.title, { color: colors.textPrimary }]}>{message}</Text>}

        {description && <Text style={[styles.description, { color: colors.textPrimary }]}>{description}</Text>}
      </View>

      <Animated.View style={[styles.duration, { transform: [{ translateX }], opacity, backgroundColor: progressBg }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 6,
    overflow: 'hidden',
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  textArea: {
    flex: 1,
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
    width: messageWidth,
    height: 4,
    backgroundColor: 'red',
    bottom: 0,
    left: 0,
  },
});

export default CustomMessage;
