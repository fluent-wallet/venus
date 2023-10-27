import { Button, ButtonProps, useTheme } from '@rneui/themed';
import { PropsWithChildren, FC } from 'react';

const BaseButton: FC<PropsWithChildren<ButtonProps>> = ({ children, ...rest }) => {
  const {
    theme: { colors },
  } = useTheme();

  return (
    <Button
      buttonStyle={{
        backgroundColor: colors.textBrand,
        borderRadius: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      disabledStyle={{
        backgroundColor: colors.buttonDisabledBackground,
      }}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default BaseButton;
