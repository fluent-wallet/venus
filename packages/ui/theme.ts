import { createTheme } from '@rneui/themed';
const colors = {
  gray0: '#F7F7F7',
  gray1: '#A3A3A3',
  gray2: '#A3A3A3',
  gray3: '#737373',
  gray4: '#242424',
  gray5: '#171717',

  blue0: '#F2F5FF',
  blue1: '#D9E3FF',
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
};


const theme = createTheme({
  lightColors: {
    textColorPrimary: colors.gray5,
    textColorSecondary: colors.gray2,
    textColorBrand: colors.blue3,
    textColorInvert: colors.gray0,
    borderColorPrimary: colors.gray1,
    surfacePrimary: colors.gray0,
    surfaceSecondary: colors.blue1,
    surfaceBrand: colors.blue3,
    surfaceInvert: colors.white,
    warnSuccessPrimary: colors.green4,
    warnErrorPrimary: colors.red4,
  },
  darkColors: {
    textColorPrimary: colors.gray1,
    textColorSecondary: colors.gray3,
    textColorBrand: colors.blue2,
    textColorInvert: colors.gray5,
    borderColorPrimary: colors.gray4,
    surfacePrimary: colors.gray5,
    surfaceSecondary: colors.blue4,
    surfaceBrand: colors.blue2,
    surfaceInvert: colors.white,
    warnSuccessPrimary: colors.green3,
    warnErrorPrimary: colors.red3,
  },
  components: {
    Button: (props, theme) => ({
      buttonStyle: {
        backgroundColor: theme.colors.textColorBrand,
        borderRadius: 40,
      },
    }),
  },
});

export { theme };
