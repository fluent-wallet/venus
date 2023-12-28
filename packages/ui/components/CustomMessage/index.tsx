import React from 'react';
import { View, Text, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { type Message } from 'react-native-flash-message';
import clsx from 'clsx';
import { useTheme } from '@rneui/themed';
import CheckCircle from '@assets/icons/check_circle.svg';
import WarningAlert from '@assets/icons/warning_alert.svg';

const CustomMessage: React.FC<{ message: Message; icon?: { icon: any }; className?: string; style?: StyleProp<ViewStyle> }> = ({
  className,
  style,
  message: { type, message, description },
  icon,
}) => {
  const { theme } = useTheme();

  return (
    <View className={clsx(className, className === undefined && 'pb-[100px]')} style={style}>
      <View className="relative mx-auto w-[364px] p-[12px] rounded-[6px] overflow-hidden">
        <View
          className="absolute left-[0px] top-[0px] w-[125%] h-[200%] pointer-events-none opacity-90"
          style={{ backgroundColor: type === 'success' ? theme.colors.surfaceBrand : theme.colors.alertWarning }}
        />
        <View className="flex flex-row justify-between items-center z-100">
          {message && (
            <Text className="max-w-[300px] text-[14px] leading-[22px]" style={{ color: theme.colors.textInvert }}>
              {message}
            </Text>
          )}

          <View className="flex-shrink-0 flex-grow-0">
            {icon?.icon === 'loading' && <ActivityIndicator color={theme.colors.textInvert} size={24} />}
            {typeof icon?.icon === 'object' && icon?.icon}

            {!icon?.icon && (
              <>
                {type === 'success' ? (
                  <CheckCircle width={24} height={24} color={theme.colors.textInvert} />
                ) : (
                  <WarningAlert width={24} height={24} color={theme.colors.textInvert} />
                )}
              </>
            )}
          </View>
        </View>
        {description && (
          <Text className="mt-[4px] text-[10px] leading-[16px]" style={{ color: theme.colors.textInvert }}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );
};

export default CustomMessage;
