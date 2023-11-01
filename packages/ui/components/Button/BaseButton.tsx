import { Button, ButtonProps, useTheme } from '@rneui/themed';
import { PropsWithChildren, FC } from 'react';

const BaseButton: FC<PropsWithChildren<ButtonProps>> = ({ children, containerStyle = {}, buttonStyle = {}, ...rest }) => {
  const {
    theme: { colors },
  } = useTheme();

  return (
    <Button
      buttonStyle={Object.assign(
        {
          backgroundColor: colors.textBrand,
          borderRadius: 40,
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        buttonStyle
      )}
      containerStyle={containerStyle}
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
