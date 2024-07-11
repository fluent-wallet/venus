import { Image, type ImageProps } from 'expo-image';
import type React from 'react';
import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';

interface IconProps extends ImageProps {
  width: number;
  height: number;
  rounded?: boolean;
}

const Icon: React.FC<IconProps> = ({ style, width, height, rounded, ...props }) => {
  const needRenderSVG = useMemo(() => Platform.OS === 'ios' && typeof props.source === 'string' && props.source.endsWith('svg'), [props.source]);
  if (needRenderSVG) {
    return <SvgUri style={[style, rounded ? { borderRadius: width / 2 } : {}]} uri={props.source as string} width={width} height={height} />;
  }

  return (
    <Image
      style={[style, { width, height }, rounded ? { borderRadius: width / 2 } : {}]}
      placeholder={props.placeholder}
      placeholderContentFit="contain"
      contentFit="contain"
      {...props}
    />
  );
};
export default Icon;
