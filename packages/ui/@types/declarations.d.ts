import '@rneui/themed';

declare module '@rneui/themed' {
  export interface Colors {
    textPrimary: string;
    textSecondary: string;
    textBrand: string;
    textInvert: string;
    borderPrimary: string;
    surfacePrimary: string;
    surfaceSecondary: string;
    surfaceBrand: string;
    surfaceInvert: string;
    warnSuccessPrimary: string;
    warnErrorPrimary: string;
    linearGradientBackground: string[];
  }
}