import { Button, ButtonProps, useTheme } from '@rneui/themed';
import { PropsWithChildren, FC } from 'react';

const BaseButton: FC<PropsWithChildren<ButtonProps>> = ({ children, containerStyle = {}, buttonStyle = {}, ...rest }) => {
  const {
    theme: { colors },
  } = useTheme();

  return (
    <Button
      className=" bg"
      buttonStyle={[
        {
          backgroundColor: colors.textBrand,
          borderRadius: 7,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        buttonStyle,
      ]}
      containerStyle={containerStyle}
      disabledStyle={{
        backgroundColor: 'transparent',
        borderColor: colors.textSecondary,
        borderWidth: 1,
      }}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default BaseButton;
