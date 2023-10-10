import '@rneui/themed';

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
    linearGradientBackground: string[];
  }
}