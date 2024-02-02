import React from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Check from '@assets/icons/check.svg';

interface Props extends PressableProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

const Checkbox: React.FC<Props> = ({ checked, onChange, ...props }) => {
  const { colors, palette } = useTheme();

  return (
    <Pressable style={[styles.checkbox, { backgroundColor: colors.up }]} onPress={!onChange ? undefined : () => onChange?.(!checked)} {...props}>
      <Check color={checked ? palette.gray8 : palette.gray0} />
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
    borderRadius: 4,
  },
});

export default Checkbox;
