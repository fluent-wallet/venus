import { useState, useEffect } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const useForceUpdateOnFocus = (navigation: NativeStackNavigationProp<any, any, any>) => {
  const [_, forceUpdate] = useState(true);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      forceUpdate((pre) => !pre);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation]);
};

export default useForceUpdateOnFocus;
