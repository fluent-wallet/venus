/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line no-undef
module.exports = {
  content: ['./packages/ui/App.{js,jsx,ts,tsx}', './packages/ui/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sfp: ['SF Pro Display'],
      },
    },
  },
  plugins: [],
};
