import { Image, ImageProps, ImageURISource } from 'react-native';
import { SvgUri, Image as SvgImg, SvgXml } from 'react-native-svg';
import { styled } from 'nativewind';
import { useState } from 'react';
import isURL from 'validator/es/lib/isURL';
import isBase64 from 'validator/es/lib/isBase64';
import isDataURI from 'validator/es/lib/isDataURI';

// the Image component in react-native does not support svg, so we need to use SvgUri to support svg

const MixinImage: React.FC<ImageProps & { source: ImageURISource } & { fallback?: string | React.JSX.Element }> = (props) => {
  const [e, setE] = useState(false);
  const {
    source: { uri },
  } = props;
  // for now we get the extension for the uri, but for the future we can get the extension from the response header
  const extension = uri?.split('.').pop();

  const getFailBack = () => {
    if (typeof props.fallback === 'string') {
      return <Image {...props} source={{ uri: props.fallback }} />;
    }
    if (typeof props.fallback === 'object') {
      return props.fallback;
    }
    return null;
  };

  if (uri && extension && extension === 'svg') {
    return <SvgUri uri={uri} width={props.width} height={props.height} style={props.style} />;
  }
  
  if (props.source.uri && !isURL(`${props.source.uri}`) && !isDataURI(`${props.source.uri}`)) {
    // if the uri is not a valid url, we will use the fallback
    return getFailBack();
  }

  if (e) {
    return getFailBack();
  }
  return <Image {...props} onError={() => setE(true)} />;
};

export default styled(MixinImage);
