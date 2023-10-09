import { createTheme } from '@rneui/themed';

const theme = createTheme({
  components: {
    Button: (props = { buttonStyle: {} }, theme) => ({
      buttonStyle: {
        backgroundColor: theme.mode === 'light' ? '#4572EC' : '#537FF6',
        borderRadius: 40,
      },
    }),
  },
});

export { theme };
