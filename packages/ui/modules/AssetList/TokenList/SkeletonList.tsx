import Skeleton from '@components/Skeleton';
import { memo } from 'react';
import { View } from 'react-native';

const randomWidth = [
  [70, 90, 90],
  [100, 60, 110],
  [120, 90, 90],
];

const SkeletonList: React.FC<{ length: number }> = ({ length }) => {
  return (
    <View className="flex-1">
      {Array.from({ length }).map((_, index) => {
        const [width1, width2, width3] = randomWidth[Math.floor(Math.random() * 3)];
        return (
          <View key={index} className={'flex flex-row  w-full p-3'}>
            <View className="w-12 h-12 mr-4">
              <Skeleton width={48} height={48} circle />
            </View>
            <View className="flex-1">
              <View className="flex flex-row flex-1 items-center justify-between">
                <View className="flex-1">
                  <Skeleton width={width1} height={16} />
                </View>
                <View className=" ml-2">
                  <Skeleton width={width2} height={16} />
                </View>
              </View>
              <View className="flex-1">
                <Skeleton width={width3} height={16} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default memo(SkeletonList);
