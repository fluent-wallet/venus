import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Button from '@components/Button';
import Text from '@components/Text';
import { HomeStackName, ReceiveStackName, type StackScreenProps } from '@router/configs';
import NoneToken from '@assets/images/none-token.webp';

const ReceiveFunds: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();

  return (
    <>
      <Image style={styles.noneImg} source={NoneToken} contentFit="contain" />
      <Text style={[styles.noneText, { color: colors.textSecondary }]}>{t('tab.content.depositToken')}</Text>
      <Button testID="receiveFunds" style={styles.btn} onPress={() => navigation.navigate(ReceiveStackName)}>
        {t('tab.content.receive')}
      </Button>
    </>
  );
};

export const styles = StyleSheet.create({
  noneImg: {
    alignSelf: 'center',
    width: 160,
    aspectRatio: 1,
    marginTop: 24,
  },
  noneText: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btn: {
    alignSelf: 'center',
    width: 184,
  },
});

export default ReceiveFunds;
