import { useState, useMemo, useCallback, useRef, forwardRef, type Component } from 'react';
import { View, TextInput, StyleSheet, Pressable, Platform, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
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
  SuffixIcon?: typeof Component<SvgProps>;
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
    const [hasValue, setHasValue] = useState(defaultHasValue ?? isDev);
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
          {...props}
          onChangeText={handleChangeText}
        />
        {showClear && !disabled && (
          <Pressable onPress={() => handlePressClear()}>
            <Clear style={[styles.icon, { opacity: hasValue ? 1 : 0 }]} color={colors.iconPrimary} />
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
        {SuffixIcon && (
          <Pressable onPress={onPressSuffixIcon}>
            <SuffixIcon style={styles.icon} color={colors.iconPrimary} />
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
