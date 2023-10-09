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

/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line no-undef
module.exports = {
  content: ['./packages/ui/App.{js,jsx,ts,tsx}', './packages/ui/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      textColor: {
        primary: {
          light: colors.gray5,
          dark: colors.gray1,
        },
        secondary: {
          light: colors.gray2,
          dark: colors.gray3,
        },
        brand: {
          light: colors.blue3,
          dark: colors.blue2,
        },
        invert: {
          light: colors.gray0,
          dark: colors.gray5,
        },
      },

      borderColor: {
        primary: {
          light: colors.gray1,
          dark: colors.gray4,
        },
      },

      colors: {
        ...colors,

        surface: {
          primary: {
            light: colors.gray0,
            dark: colors.gray5,
          },
          secondary: {
            light: colors.blue1,
            dark: colors.gray5,
          },
          brand: {
            light: colors.blue3,
            dark: colors.blue2,
          },
          invert: {
            light: colors.white,
            dark: colors.white,
          },
        },

        warn: {
          'success-primary': {
            light: colors.green4,
            dark: colors.green3,
          },
          'error-primary': {
            light: colors.red4,
            dark: colors.red3,
          },
        },
      },
    },
  },
  plugins: [],
};
