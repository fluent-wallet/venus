import React, { type ComponentProps } from 'react';
import { useColorScheme, View, ImageBackground, Image, type StyleProp, type ViewStyle } from 'react-native';
import BgLight from '@assets/images/wallet-bg-light.webp';
import BgDark from '@assets/images/wallet-bg-dark.webp';

interface Props extends ComponentProps<typeof ImageBackground> {
  contentStyle?: StyleProp<ViewStyle>;
  contentClassName?: string;
}

const Background: React.FC<Omit<Props, 'source'>> = ({ children, contentStyle, contentClassName, ...props }) => {
  const model = useColorScheme();

  return (
    <ImageBackground resizeMode="stretch" source={model === 'dark' ? BgDark : BgLight} {...props}>
      <View className={contentClassName} style={contentStyle}>
        {children}
      </View>
    </ImageBackground>
  );
};

export const BackgroundImage: React.FC<Omit<ComponentProps<typeof Image>, 'source'>> = (props) => {
  const model = useColorScheme();

  return <Image source={model === 'dark' ? BgDark : BgLight} {...props} />;
};

export default Background;
