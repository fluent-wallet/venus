import React, { type ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from '@rneui/themed';
import LinearGradient from 'react-native-linear-gradient';

const LinearGradientBackground: React.FC<Omit<ComponentProps<typeof View>, 'colors'>> = ({ children, ...props }) => {
  const { theme } = useTheme();
  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} {...props}>
      {children}
    </LinearGradient>
  );
};

export default LinearGradientBackground;
