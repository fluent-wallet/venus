import { useState, useMemo, useCallback, useRef, forwardRef, useEffect, isValidElement, type Component } from 'react';
import { View, TextInput, StyleSheet, Pressable, Platform, Keyboard, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { type SvgProps } from 'react-native-svg';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
import { BottomSheetTextInput } from '@components/BottomSheet';
import { isDev } from '@utils/getEnv';
import EyeOpen from '@assets/icons/eye-open.svg';
import EyeClose from '@assets/icons/eye-close.svg';
import Clear from '@assets/icons/clear.svg';

interface Props extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  showVisible?: boolean;
  showClear?: boolean;
  defaultHasValue?: boolean;
  disabled?: boolean;
  isInBottomSheet?: boolean;
  SuffixIcon?: typeof Component<SvgProps> | React.ReactNode;
  onPressSuffixIcon?: () => void;
}

const CustomTextInput = forwardRef<TextInput, Props>(
  (
    {
      style,
      containerStyle,
      showVisible = true,
      showClear = true,
      disabled,
      value,
      defaultHasValue,
      onChangeText,
      isInBottomSheet,
      secureTextEntry,
      SuffixIcon,
      onPressSuffixIcon,
      ...props
    },
    _forwardRef,
  ) => {
    const { colors } = useTheme();

    const UsedTextInput = useMemo(() => (isInBottomSheet ? BottomSheetTextInput : TextInput), [isInBottomSheet]);

    const [visible, setVisible] = useState(isDev);
    const [hasValue, setHasValue] = useState(() => (value !== undefined ? !!value : defaultHasValue ?? isDev));
    const handleChangeText = useCallback(
      (text: string) => {
        const filterText = text.replace(/[^\w\s.:,\-;?!@#$%^&*() \u4e00-\u9fff]+/gi, '');
        setHasValue(filterText?.length > 0);
        onChangeText?.(filterText);
      },
      [onChangeText],
    );

    const inputRef = useRef<TextInput>(null!);

    const handlePressClear = useCallback(() => {
      inputRef.current?.clear?.();
      onChangeText?.('');
      setHasValue(false);
    }, [onChangeText]);

    useEffect(() => {
      if (value !== undefined) {
        setHasValue(!!value);
      }
    }, [value]);

    return (
      <View style={[styles.defaultContainerStyle, { backgroundColor: colors.bgSecondary }, containerStyle]}>
        <UsedTextInput
          ref={composeRef([inputRef, _forwardRef as any])}
          style={[
            styles.defaultInputStyle,
            props.multiline && styles.defaultMultilineInputStyle,
            { color: colors.textPrimary, fontWeight: hasValue ? '600' : '300' },
            style,
          ]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={showVisible ? !visible : secureTextEntry || false}
          value={value}
          {...props}
          onChangeText={handleChangeText}
        />
        {showClear && !disabled && (
          <Pressable onPress={() => handlePressClear()}>
            <Clear style={[styles.icon, { opacity: hasValue ? 1 : 0 }]} color={colors.iconPrimary} />
          </Pressable>
        )}
        {showVisible && !disabled && (
          <Pressable
            onPress={() => {
              inputRef.current?.blur();
              setVisible((pre) => !pre);
              setTimeout(() => {
                if (!Keyboard.isVisible()) {
                  inputRef.current?.focus();
                }
              }, 200);
            }}
          >
            {visible ? (
              <EyeClose style={[styles.icon]} color={hasValue ? colors.iconPrimary : colors.iconThird} />
            ) : (
              <EyeOpen style={[styles.icon]} color={hasValue ? colors.iconPrimary : colors.iconThird} />
            )}
          </Pressable>
        )}
        {SuffixIcon && (
          <Pressable onPress={onPressSuffixIcon}>
            {isValidElement(SuffixIcon) ? SuffixIcon : typeof SuffixIcon === 'function' ? <SuffixIcon style={styles.icon} color={colors.iconPrimary} /> : null}
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
    fontWeight: '600',
    height: 48,
    flexGrow: 1,
    flexShrink: 1,
  },
  defaultMultilineInputStyle: {
    height: 'auto',
    minHeight: 48,
    maxHeight: 96,
    ...Platform.select({
      ios: {
        paddingTop: 14,
        paddingBottom: 14,
      },
      android: {
        textAlignVertical: 'center',
      },
    }),
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
