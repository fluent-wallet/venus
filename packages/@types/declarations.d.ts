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
    surfaceCard: string;
    warnSuccessPrimary: string;
    warnErrorPrimary: string;
    linearGradientBackground: string[];
    normalBackground: string;
    passwordInputBackground: string;
    buttonDisabledBackground:string
    homeHeaderAddressBackgroundColor:string
    pureBlackAndWight:string
  }
}