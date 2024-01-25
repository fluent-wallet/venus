import { useMemo, useCallback, type Component, type PropsWithChildren } from 'react';
import { StyleSheet, Pressable, useColorScheme, type PressableProps, type PressableStateCallbackType, type SvgProps } from 'react-native';
import Text from '@components/Text';
import Hourglass from './Hourglass';
import { palette } from '../../theme';

interface Props extends PropsWithChildren<PressableProps> {
  mode?: 'light' | 'dark' | 'auto';
  size?: 'small' | 'medium' | 'large';
  textAlign?: 'left' | 'center' | 'right';
  loading?: boolean;
  square?: boolean;
  Icon?: typeof Component<SvgProps>;
}

const Button = ({ children, loading, size = 'medium', disabled: _disabled, mode: _mode = 'dark', textAlign = 'center', square, Icon, ...props }: Props) => {
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
    ],
    [mode, size, disabled, square, textAlign],
  );
  const textStyle = useMemo(() => [styles.text, styles[`text-${mode}`], disabled && styles[`text-${mode}-disabled`]], [mode, disabled]);
  const iconStyle = useMemo(
    () => ({
      marginLeft: textAlign === 'center' ? 10 : ('auto' as const),
      width: 24,
      height: 24
    }),
    [textAlign],
  );

  return (
    <Pressable style={containerStyle} disabled={disabled || loading} {...props}>
      {typeof children === 'string' ? <Text style={textStyle}>{children}</Text> : children}
      {Icon && !loading && <Icon style={[textStyle, iconStyle]} />}
      {loading && <Hourglass color={styles[`text-${mode}`].color} style={iconStyle} />}
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
    height: 48,
  },
  ['button-small-square']: {
    width: 48,
  },
  ['button-medium']: {
    height: 56,
  },
  ['button-medium-square']: {
    width: 56,
  },
  ['button-large']: {
    height: 64,
  },
  ['button-large-square']: {
    width: 64,
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
