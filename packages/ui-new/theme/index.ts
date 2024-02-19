export const palette = {
  blue0: '#DEE6FB',
  blue1: '#C2D2FB',
  blue2: '#8BAAFC',
  blue3: '#5383FD',
  blue4: '#1C5BFE',
  blue5: '#003FE3',
  blue6: '#002FAA',
  blue7: '#001855',
  blue8: '#00081C',

  green0: '#F5FEFF',
  green1: '#E1FBFF',
  green2: '#CEF8FF',
  green3: '#A6F3FF',
  green4: '#48E6FF',
  green5: '#00CAEA',
  green6: '#00798C',
  green7: '#00515E',
  green8: '#00282F',

  gray0: '#FAFAFA',
  gray1: '#EDEDED',
  gray2: '#D5D5D5',
  gray3: '#B7B7B7',
  gray4: '#999999',
  gray5: '#6F6F6F',
  gray6: '#535353',
  gray7: '#383838',
  gray8: '#1E1E1E',

  red: '#FD6464',
  white: '#FFFFFF',
  black: '#000000',
};

export const lightColors = {
  bgPrimary: palette.gray0,
  bgSecondary: palette.gray1,
  bgThird: palette.gray8,
  bgFourth: palette.white,
  bgSelect: palette.green3,
  textPrimary: palette.gray8,
  textSecondary: palette.gray4,
  textThird: palette.gray8,
  textFourth: palette.gray1,
  textFifth: palette.gray1,
  textNotice: palette.green5,
  borderPrimary: palette.gray8,
  borderSecondary: palette.gray8,
  borderThird: palette.gray2,
  borderFourth: palette.gray1,
  iconPrimary: palette.gray8,
  iconSecondary: palette.gray2,
  iconThird: palette.gray4,
  iconFourth: palette.gray8,
  iconFifth: palette.gray0,
  underlay: palette.gray2,
  up: palette.green5,
  down: palette.red,
};

export const darkColors: typeof lightColors = {
  bgPrimary: palette.gray8,
  bgSecondary: palette.gray7,
  bgThird: palette.gray0,
  bgFourth: palette.gray7,
  bgSelect: palette.green4,
  textPrimary: palette.gray1,
  textSecondary: palette.gray5,
  textThird: palette.gray8,
  textFourth: palette.gray1,
  textFifth: palette.gray8,
  textNotice: palette.green4,
  borderPrimary: palette.gray2,
  borderSecondary: palette.gray8,
  borderThird: palette.gray7,
  borderFourth: palette.gray6,
  iconPrimary: palette.gray2,
  iconSecondary: palette.gray6,
  iconThird: palette.gray5,
  iconFourth: palette.gray8,
  iconFifth: palette.gray8,
  underlay: palette.gray7,
  up: palette.green4,
  down: palette.red,
};

const defaultFont = {
  regular: {
    fontFamily: 'Sora',
    fontWeight: '400',
  },
  medium: {
    fontFamily: 'Sora',
    fontWeight: '500',
  },
  bold: {
    fontFamily: 'Sora',
    fontWeight: '600',
  },
  heavy: {
    fontFamily: 'Sora',
    fontWeight: '700',
  },
};
export const fonts = {
  ...defaultFont,
  sora: defaultFont,
  stalinistOne: {
    regular: {
      fontFamily: 'Stalinist One',
      fontWeight: '400',
    },
  },
};

export interface CustomTheme {
  mode: 'light' | 'dark';
  colors: typeof lightColors;
  palette: typeof palette;
}
