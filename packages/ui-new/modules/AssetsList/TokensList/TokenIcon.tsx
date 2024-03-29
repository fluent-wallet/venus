import React, { useMemo } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Image, type ImageProps } from 'expo-image';
import defaultTokenIcon from '@assets/icons/defaultToken.webp';

const TokenIcon: React.FC<ImageProps> = ({ style, ...props }) => {
  const needRenderSVG = useMemo(() => Platform.OS === 'ios' && typeof props.source === 'string' && props.source.endsWith('svg'), [props.source]);

  if (needRenderSVG) {
    return <SvgUri style={[styles.container, typeof style === 'object' && style]} uri={props.source as string} width={40} height={40} />;
  }

  return (
    <Image
      style={[styles.container, typeof style === 'object' && style]}
      placeholder={defaultTokenIcon}
      placeholderContentFit="contain"
      contentFit="contain"
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
  },
});

export default TokenIcon;
