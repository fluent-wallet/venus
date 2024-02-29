import React, { type MutableRefObject } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import { screenHeight } from '@utils/deviceInfo';
import { BackupStackName, HomeStackName, type StackScreenProps } from '@router/configs';
import Img from '@assets/images/welcome-img.webp';
import BackupBottomSheet from './BackupBottomSheet';

export const BackupSuccessStackName = 'BackupSuccess';

const BackupSuccess: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<StackScreenProps<typeof BackupStackName>['navigation']>();

  return (
    <BackupBottomSheet onClose={() => navigation.navigate(HomeStackName)}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>🥳 Backuped !</Text>
        <Image style={styles.img} source={Img} contentFit="contain" />

        <Button
          style={styles.btn}
          onPress={() => {
            navigation.navigate(HomeStackName);
          }}
        >
          OK
        </Button>
      </View>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
  },
  img: {
    alignSelf: 'center',
    width: '60%',
    aspectRatio: 1.285,
    marginTop: 12,
    marginBottom: 'auto',
  },
  btn: {
    marginHorizontal: 16,
  },
});

const snapPoints = [`${((440 / screenHeight) * 100).toFixed(2)}%`];

export default BackupSuccess;
