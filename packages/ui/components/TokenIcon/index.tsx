import { AssetType } from '@core/database/models/Asset';
import CFXTokenIcon from '@assets/icons/cfxToken.svg';
import MixinImage from '@components/MixinImage';
import DefaultTokenIcon from '@assets/icons/defaultToken.svg';

const TokenIcon: React.FC<{ type: AssetType; url?: string; width: number; height: number }> = ({ type, url, width, height }) => {
  if (type === AssetType.Native) {
    return <CFXTokenIcon />;
  }

  return url ? (
    <MixinImage
      source={{ uri: url, width, height }}
      fallback={<DefaultTokenIcon width={width} height={height} />}
      width={width}
      height={height}
      resizeMode="cover"
    />
  ) : (
    <DefaultTokenIcon width={width} height={height} />
  );
};
export default TokenIcon;
