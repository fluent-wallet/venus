import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { type Message } from 'react-native-flash-message';
import { useTheme } from '@react-navigation/native';
import CheckCircle from '@assets/icons/check_circle.svg';
import WarningAlert from '@assets/icons/warning_alert.svg';

const CustomMessage: React.FC<{ message: Message; icon?: { icon: any }; style?: StyleProp<ViewStyle> }> = ({
  style,
  message: { type, message, description },
  icon,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View
          className="absolute left-[0px] top-[0px] w-[125%] h-[200%] pointer-events-none opacity-90"
          style={{ backgroundColor: type === 'success' ? colors.bgPrimary : colors.bgThird }}
        />
        <View className="flex flex-row justify-between items-center z-100">
          {message && (
            <Text className="max-w-[300px] text-[14px] leading-[22px]" style={{ color: colors.textPrimary }}>
              {message}
            </Text>
          )}

          <View className="flex-shrink-0 flex-grow-0">
            {icon?.icon === 'loading' && <ActivityIndicator color={colors.textPrimary} size={24} />}
            {typeof icon?.icon === 'object' && icon?.icon}

            {!icon?.icon && (
              <>
                {type === 'success' ? (
                  <CheckCircle width={24} height={24} color={colors.textPrimary} />
                ) : (
                  <WarningAlert width={24} height={24} color={colors.textPrimary} />
                )}
              </>
            )}
          </View>
        </View>
        {description && (
          <Text className="mt-[4px] text-[10px] leading-[16px]" style={{ color: colors.textPrimary }}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    
  },
  container: {
    position: 'relative',
    marginHorizontal: 'auto',
    width: 360,
    padding: 12,
    borderRadius: 6,
    overflow: 'hidden',
  }
});

export default CustomMessage;
