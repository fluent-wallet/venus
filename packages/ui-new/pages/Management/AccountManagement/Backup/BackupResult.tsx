import React, { type MutableRefObject } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { screenHeight } from '@utils/deviceInfo';
import { BackupStackName, type StackScreenProps } from '@router/configs';
import Img from '@assets/images/welcome-img.webp';

interface Props {
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
  type: 'success' | 'failed';
}

const DeleteConfirm: React.FC<Props> = ({ type, bottomSheetRef }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<StackScreenProps<typeof BackupStackName>['navigation']>();

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isModal={false}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{type === 'success' ? '🥳 Backuped !' : '🥳 Wrong Select!'}</Text>
        <Image style={styles.img} source={Img} contentFit="contain" />

        <Button
          style={styles.btn}
          onPress={() => {
            bottomSheetRef.current?.close();
            if (type === 'success') {
              navigation.goBack();
            }
          }}
        >
          {type === 'failed' ? 'Return' : 'OK'}
        </Button>
      </View>
    </BottomSheet>
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

export default DeleteConfirm;
