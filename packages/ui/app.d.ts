/// <reference types="nativewind/types" />
import '@rneui/themed';

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '@rneui/themed' {
  export interface Colors {
    textColorPrimary: string;
    textColorSecondary: string;
    textColorBrand: string;
    textColorInvert: string;
    borderColorPrimary: string;
    surfacePrimary: string;
    surfaceSecondary: string;
    surfaceBrand: string;
    surfaceInvert: string;
    warnSuccessPrimary: string;
    warnErrorPrimary: string;
  }
}
