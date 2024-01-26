import { useMemo, useCallback, type Component, type PropsWithChildren } from 'react';
import { StyleSheet, Pressable, useColorScheme, Platform, type PressableProps, type PressableStateCallbackType } from 'react-native';
import { type SvgProps } from 'react-native-svg';
import Text from '@components/Text';
import HourglassLoading from '@components/Loading/Hourglass';
import { palette } from '../../theme';

interface Props extends PropsWithChildren<PressableProps> {
  mode?: 'light' | 'dark' | 'auto';
  size?: 'small' | 'medium' | 'large';
  textAlign?: 'left' | 'center' | 'right';
  loading?: boolean;
  square?: boolean;
  Icon?: typeof Component<SvgProps>;
}

const Button = ({
  children,
  loading,
  size = 'medium',
  disabled: _disabled,
  mode: _mode = 'dark',
  textAlign = 'center',
  square,
  Icon,
  style,
  ...props
}: Props) => {
  const systemMode = useColorScheme();

  const mode = useMemo(() => (_mode === 'auto' ? (systemMode === 'dark' ? 'dark' : 'light') : _mode), [systemMode, _mode]);
  const disabled = loading ? false : _disabled;

  const containerStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.button,
      pressed ? styles['button-pressed'] : styles['button-not-pressed'],
      styles[`button-${size}`],
      square && styles[`button-${size}-square`],
      styles[`button-${mode}`],
      styles[`button-${textAlign}`],
      pressed && styles[`button-${mode}-pressed`],
      disabled && styles[`button-${mode}-disabled`],
      typeof style !== 'function' && style,
    ],
    [mode, size, disabled, square, textAlign, style],
  );

  const textStyle = useMemo(() => ({ ...styles.text, ...styles[`text-${mode}`], ...(disabled ? styles[`text-${mode}-disabled`] : null) }), [mode, disabled]);
  const iconPositionStyle = useMemo(
    () => ({
      marginLeft: textAlign === 'center' ? 10 : ('auto' as const),
      width: 24,
      height: 24,
    }),
    [textAlign],
  );
  const iconStyle = useMemo(() => ({ ...textStyle, ...iconPositionStyle }), [textStyle, iconPositionStyle]);

  return (
    <Pressable style={containerStyle} disabled={disabled || loading} {...props}>
      {typeof children === 'string' ? <Text style={textStyle}>{children}</Text> : children}
      {Icon && !loading && <Icon style={iconStyle} />}
      {loading && <HourglassLoading color={styles[`text-${mode}`].color} style={iconPositionStyle} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderRightWidth: 2,
    borderLeftWidth: 2,
  },
  ['button-left']: {
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  ['button-center']: {
    justifyContent: 'center',
  },
  ['button-right']: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
  },
  ['button-not-pressed']: {
    borderTopWidth: 1,
    borderBottomWidth: 4,
  },
  ['button-pressed']: {
    borderTopWidth: 4,
    borderBottomWidth: 1,
  },
  ['button-small']: {
    ...Platform.select({
      android: {
        height: 48,
      },
      ios: {
        height: 45,
      },
    }),
  },
  ['button-small-square']: {
    ...Platform.select({
      android: {
        height: 48,
      },
      ios: {
        height: 45,
      },
    }),
  },
  ['button-medium']: {
    ...Platform.select({
      android: {
        height: 56,
      },
      ios: {
        height: 53,
      },
    }),
  },
  ['button-medium-square']: {
    ...Platform.select({
      android: {
        height: 56,
      },
      ios: {
        height: 53,
      },
    }),
  },
  ['button-large']: {
    ...Platform.select({
      android: {
        height: 64,
      },
      ios: {
        height: 61,
      },
    }),
  },
  ['button-large-square']: {
    ...Platform.select({
      android: {
        height: 64,
      },
      ios: {
        height: 61,
      },
    }),
  },
  ['button-light']: {
    borderColor: palette.gray1,
    backgroundColor: palette.gray8,
  },
  ['button-light-pressed']: {
    backgroundColor: palette.gray7,
  },
  ['button-light-disabled']: {
    borderColor: palette.gray4,
  },
  ['button-dark']: {
    borderColor: palette.gray8,
    backgroundColor: palette.gray0,
  },
  ['button-dark-pressed']: {
    backgroundColor: palette.gray2,
  },
  ['button-dark-disabled']: {
    borderColor: palette.gray3,
    backgroundColor: palette.gray2,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  ['text-light']: {
    color: palette.gray1,
  },
  ['text-light-disabled']: {
    color: palette.gray4,
  },
  ['text-dark']: {
    color: palette.gray8,
  },
  ['text-dark-disabled']: {
    color: palette.gray3,
  },
});

export default Button;
