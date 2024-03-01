import { random } from 'lodash-es';
import ContentLoader, { Rect, Circle } from 'react-content-loader/native';
import { screenWidth } from '@utils/deviceInfo';

const Item = (key: string | number) => (
  <ContentLoader key={key} speed={2} width={screenWidth} height={70} viewBox={`0 0 ${screenWidth} 70`} backgroundColor="#f3f3f3" foregroundColor="#ecebeb">
    <Circle cx="36" cy="35" r="20" />
    <Rect x="64" y="15" rx="4" ry="4" width={random(120, 180)} height={18} />
    <Rect x="64" y="39" rx="4" ry="4" width={random(80, 140)} height={18} />
  </ContentLoader>
);

const Skeleton = Array.from({ length: 6 }).map((_, index) => Item(index));

export default Skeleton;
