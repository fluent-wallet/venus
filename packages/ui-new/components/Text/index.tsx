// CustomText.js

import { type PropsWithChildren } from 'react';
import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';

const CustomText = ({ children, style, ...props }: PropsWithChildren<TextProps>) => {
  return (
    <NativeText style={[styles.defaultStyle, style]} {...props}>
      {children}
    </NativeText>
  );
};

const styles = StyleSheet.create({
  defaultStyle: {
    fontFamily: 'Sora',
    letterSpacing: undefined
  },
});

export default CustomText;
