import React, { useMemo, type Component } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { type SvgProps } from 'react-native-svg';
import Check from '@assets/icons/check.svg';

interface Props extends PressableProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  Icon?: typeof Component<SvgProps>;
  reversal?: boolean;
  color?: string;
}

const Checkbox: React.FC<Props> = ({ checked, onChange, style, Icon, reversal, color, ...props }) => {
  const { colors } = useTheme();
  const UsedIcon = useMemo(() => (Icon ? Icon : Check), [Icon]);

  return (
    <Pressable
      style={[
        styles.checkbox,
        { backgroundColor: !checked || reversal ? 'transparent' : colors.up, borderColor: reversal ? 'transparent' : colors.up },
        typeof style === 'object' && style,
      ]}
      onPress={!onChange ? undefined : () => onChange?.(!checked)}
      {...props}
    >
      <UsedIcon color={color || (reversal ? colors.up : checked ? colors.iconFifth : 'transparent')} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  checkbox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4.8,
  },
});

export default Checkbox;
