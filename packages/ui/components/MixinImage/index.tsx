import { Image, ImageProps, ImageURISource } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { styled } from 'nativewind';

// the Image component in react-native does not support svg, so we need to use SvgUri to support svg

const MixinImage: React.FC<ImageProps & { source: ImageURISource }> = (props) => {
  const {
    source: { uri },
  } = props;
  // for now we get the extension for the uri, but for the future we can get the extension from the response header
  const extension = uri?.split('.').pop();

  if (uri && extension && extension === 'svg') {
    return <SvgUri uri={uri} width={props.width} height={props.height} style={props.style} />;
  }

  return <Image {...props} />;
};

export default styled(MixinImage);
