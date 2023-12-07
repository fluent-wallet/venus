import { memo } from 'react';
import { Skeleton as RNSkeletion, SkeletonProps } from '@rneui/themed';
import { useColorScheme } from 'react-native';

const Skeleton: React.FC<SkeletonProps> = ({ style, skeletonStyle, circle = false, ...res }) => {
  const colorScheme = useColorScheme();
  return (
    <RNSkeletion
      style={[{ backgroundColor: colorScheme === 'dark' ? 'rgba(115, 115, 115,0.3)' : '#E5E5E5', borderRadius: circle ? 50 : 4 }, style]}
      skeletonStyle={[{ backgroundColor: colorScheme === 'dark' ? 'rgba(115, 115, 115,0.3)' : '#E5E5E5', borderRadius: circle ? 50 : 4 }, skeletonStyle]}
      {...res}
    />
  );
};

export default memo(Skeleton);
