import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Image, type ImageProps } from 'expo-image';

interface IconProps extends ImageProps {
  width: number;
  height: number;
}

const Icon: React.FC<IconProps> = ({ style, width, height, ...props }) => {
  const needRenderSVG = useMemo(() => Platform.OS === 'ios' && typeof props.source === 'string' && props.source.endsWith('svg'), [props.source]);
  if (needRenderSVG) {
    return <SvgUri style={[style]} uri={props.source as string} width={width} height={height} />;
  }

  return <Image style={[style, { width, height }]} placeholder={props.placeholder} placeholderContentFit="contain" contentFit="contain" {...props} />;
};
export default Icon;
