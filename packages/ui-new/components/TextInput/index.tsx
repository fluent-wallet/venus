import { useState, useCallback, useRef, forwardRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@react-navigation/native';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
import { isDev } from '@utils/getEnv';
import EyeOpen from '@assets/icons/eye-open.svg';
import EyeClose from '@assets/icons/eye-close.svg';
import Clear from '@assets/icons/clear.svg';

interface Props extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  showVisible?: boolean;
  showClear?: boolean;
  disabled?: boolean;
}

const CustomTextInput = forwardRef<TextInput, Props>(
  ({ style, containerStyle, showVisible = true, showClear = true, disabled, onChangeText, ...props }, _forwardRef) => {
    const { colors } = useTheme();
    const [visible, setVisible] = useState(isDev);
    const [hasValue, setHasValue] = useState(isDev);
    const handleChangeText = useCallback(
      (text: string) => {
        setHasValue(text?.length > 0);
        onChangeText?.(text);
      },
      [onChangeText],
    );

    const inputRef = useRef<TextInput>(null!);

    const handlePressClear = useCallback(() => {
      inputRef.current?.clear?.();
      onChangeText?.('');
      setHasValue(false);
    }, [onChangeText]);

    return (
      <View style={[styles.defaultContainerStyle, { backgroundColor: colors.bgSecondary }, containerStyle]}>
        <TextInput
          ref={composeRef([inputRef, _forwardRef as any])}
          style={[styles.defaultInputStyle, { color: colors.textPrimary, fontWeight: hasValue ? '600' : '300' }, style]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={showVisible ? !visible : undefined}
          {...props}
          onChangeText={handleChangeText}
        />
        {showClear && !disabled && (
          <Pressable onPress={() => handlePressClear()}>
            <Clear style={[styles.icon, { opacity: hasValue ? 1 : 0 }]} color={colors.textPrimary} />
          </Pressable>
        )}
        {showVisible && !disabled && (
          <Pressable onPress={() => setVisible((pre) => !pre)}>
            {visible ? (
              <EyeClose style={[styles.icon]} color={hasValue ? colors.iconPrimary : colors.iconThird} />
            ) : (
              <EyeOpen style={[styles.icon]} color={hasValue ? colors.iconPrimary : colors.iconThird} />
            )}
          </Pressable>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  defaultContainerStyle: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 16,
  },
  defaultInputStyle: {
    fontFamily: 'Sora',
    fontSize: 16,
    height: 48,
    flexGrow: 1,
    flexShrink: 1,
  },
  icon: {
    flexGrow: 0,
    flexShrink: 0,
    width: 24,
    height: 24,
    marginLeft: 8,
  },
});

export default CustomTextInput;
