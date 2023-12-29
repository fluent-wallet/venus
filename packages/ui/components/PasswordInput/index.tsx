import { Input, Text, useTheme } from '@rneui/themed';
import { View, type NativeSyntheticEvent, type TextInputFocusEventData, useColorScheme } from 'react-native';
import LockIcon from '@assets/icons/lock.svg';
import VisibilityOffIcon from '@assets/icons/visibility_off.svg';
import VisibilityIcon from '@assets/icons/visibility.svg';
import WaringIcon from '@assets/icons/warning_1.svg';
import { useState } from 'react';
import { Icon, InputProps } from '@rneui/base';

interface Props {
  title: string;
  value: string;
  onChangeText: (v: string) => void;
  visible?: boolean;
  errorMessage?: string;
  errorMessagePlaceholder?: boolean;
  successMessage?: string;
  helperText?: string;
  testId?: string;
  disableRightIcon?: boolean;
}

function Password(props: Props & InputProps) {
  const {
    theme: { colors },
  } = useTheme();
  const isDark = useColorScheme() === 'dark';
  const {
    title,
    value,
    onChangeText,
    helperText,
    errorMessage = '',
    successMessage = '',
    errorMessagePlaceholder = false,
    disableRightIcon: disableLiftIcon = false,
    ...res
  } = props;
  const [visible, setVisible] = useState(props?.visible ?? true);

  return (
    <View testID={props.testId}>
      <Text className="text-[20px] font-bold leading-tight my-[15px]">{title}</Text>
      <View className="rounded-[7px]" style={{ backgroundColor: colors.passwordInputBackground }}>
        <Input
          {...res}
          testID="passwordInput"
          value={value}
          inputContainerStyle={{ borderBottomWidth: 0 }}
          placeholderTextColor={colors.textSecondary}
          ErrorComponent={() => null}
          placeholder="Password"
          secureTextEntry={visible}
          onChangeText={onChangeText}
          leftIcon={<Icon name="123" Component={LockIcon} style={{ color: isDark ? colors.surfaceFourth : colors.textPrimary }} />}
          rightIcon={
            !disableLiftIcon ?? (
              <Icon
                testID="passwordInputRightIcon"
                name="123"
                style={{ color: isDark ? colors.surfaceFourth : colors.textPrimary }}
                Component={visible ? VisibilityOffIcon : VisibilityIcon}
                onPress={() => setVisible(!visible)}
              />
            )
          }
        />
      </View>
      <View className="mt-[7px] ">
        {helperText && !errorMessage && !successMessage && (
          <Text className="leading-tight text-base" style={{ color: colors.textSecondary }}>
            {helperText}
          </Text>
        )}
        {(errorMessage || errorMessagePlaceholder) && (
          <View className="flex flex-row items-center" style={{ opacity: errorMessage ? 100 : 0 }}>
            <WaringIcon color="#EF4444" />
            <Text className="ml-[10px] text-base" style={{ color: colors.warnErrorPrimary }}>
              {errorMessage || 'transparent'}
            </Text>
          </View>
        )}
        {successMessage && (
          <View className="flex flex-row items-center">
            <Text className="ml-[10px] text-base" style={{ color: colors.warnSuccessPrimary }}>
              {successMessage}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default Password;
