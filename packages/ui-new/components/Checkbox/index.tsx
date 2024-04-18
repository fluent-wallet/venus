import React from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Check from '@assets/icons/check.svg';

interface Props extends PressableProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  showBorder?: boolean;
}

const Checkbox: React.FC<Props> = ({ checked, onChange, style, showBorder = true, ...props }) => {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.checkbox, { borderColor: showBorder ? colors.up : 'transparent' }, typeof style === 'object' && style]}
      onPress={!onChange ? undefined : () => onChange?.(!checked)}
      {...props}
    >
      <Check color={checked ? colors.up : 'transparent'} />
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
    borderWidth: 1.5,
  },
});

export default Checkbox;
