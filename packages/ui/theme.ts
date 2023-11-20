import { createTheme } from '@rneui/themed';
export const colors = {
  gray0: '#FAFAFA',
  gray1: '#E5E5E5',
  gray2: '#A3A3A3',
  gray3: '#737373',
  gray4: '#404040',
  gray5: '#171717',

  blue0: '#F2F5FF',
  blue1: '#C0D1FF',
  blue2: '#537FF6',
  blue3: '#4572EC',
  blue4: '#234296',
  blue5: '#031E68',

  green0: '#F0FDF4',
  green1: '#BBF7D0',
  green2: '#4ADE80',
  green3: '#22C55E',
  green4: '#16A34A',
  green5: '#166534',

  red0: '#FEF2F2',
  red1: '#FECACA',
  red2: '#F87171',
  red3: '#EF4444',
  red4: '#DC2626',
  red5: '#991B1B',

  white: '#FFFFFF',
  black: '#000000',
  underlayLight: '#dddddd',
  underlayDark: '#dddddd',
};

const theme = createTheme({
  lightColors: {
    textPrimary: colors.gray5,
    textSecondary: colors.gray2,
    textBrand: colors.blue3,
    textInvert: colors.gray0,
    borderPrimary: colors.gray1,
    surfacePrimary: colors.gray0,
    surfaceSecondary: colors.blue1,
    surfaceBrand: colors.blue3,
    surfaceInvert: colors.white,
    surfaceThird: colors.blue0,
    surfaceFourth: colors.gray2,
    surfaceCard: colors.white,
    warnSuccessPrimary: colors.green4,
    warnErrorPrimary: colors.red4,
    linearGradientBackground: ['#DFE6FF', colors.white],
    normalBackground: '#F7F7F7',
    passwordInputBackground: colors.white,
    buttonDisabledBackground: '#D9E3FF',
    homeHeaderAddressBackgroundColor: colors.blue0,
    pureBlackAndWight: colors.white,
    underlayColor: colors.underlayLight,
    contrastWhiteAndBlack: colors.black,
  },
  darkColors: {
    textPrimary: colors.gray1,
    textSecondary: colors.gray3,
    textBrand: colors.blue2,
    textInvert: colors.gray5,
    borderPrimary: colors.gray4,
    surfacePrimary: colors.gray5,
    surfaceSecondary: colors.blue4,
    surfaceBrand: colors.blue2,
    surfaceInvert: colors.white,
    surfaceThird: colors.blue5,
    surfaceFourth: colors.gray2,
    surfaceCard: '#242424',
    warnSuccessPrimary: colors.green3,
    warnErrorPrimary: colors.red3,
    linearGradientBackground: ['#001C69', colors.black],
    normalBackground: colors.gray5,
    passwordInputBackground: '#242424',
    buttonDisabledBackground: colors.blue4,
    homeHeaderAddressBackgroundColor: colors.blue5,
    pureBlackAndWight: colors.black,
    underlayColor: colors.underlayDark,
    contrastWhiteAndBlack: colors.white,
  },
  components: {
    Text: (_, theme) => ({
      style: {
        fontFamily: 'SF Pro Display',
        color: theme.colors.textPrimary,
        fontSize: 16,
        fontWeight: '400',
      },
    }),
    ListItem: (_, theme) => ({
      containerStyle: {
        margin: 0,
        padding: 16,
        borderRadius: 8,
        borderWidth: 0,
        elevation: 0,
        borderColor: 'transparent',
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceCard,
      },
    }),
    ListItemContent: (_, theme) => ({
      style: {
        margin: 0,
        padding: 0,
      },
    }),
    Card: (_, theme) => ({
      containerStyle: {
        margin: 0,
        padding: 0,
        borderRadius: 8,
        borderWidth: 0,
        elevation: 0,
        borderColor: 'transparent',
        overflow: 'hidden',
      },
      wrapperStyle: {
        backgroundColor: theme.colors.surfaceCard,
        padding: 16,
      },
    }),
    CardDivider: (_, theme) => ({
      width: 1.5,
      color: theme.colors.borderPrimary,
    }),
    Dialog: (_, theme) => ({
      overlayStyle: {
        backgroundColor: theme.colors.surfaceCard,
        padding: 20,
        borderRadius: 8
      }
    }),
  },
});

export { theme };
