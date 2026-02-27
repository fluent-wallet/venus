import RocketIcon from '@assets/icons/rocket.svg';
import Text from '@components/Text';
import { useNavigation, useTheme } from '@react-navigation/native';
import { type HomeStackName, SpeedUpStackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

const SpeedUpButton: React.FC<{ txId: string; containerStyle?: StyleProp<ViewStyle>; cancelDisabled?: boolean }> = ({
  txId,
  containerStyle,
  cancelDisabled,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();
  const handlePressCancel = useCallback(() => {
    if (cancelDisabled) return;
    navigation.navigate(SpeedUpStackName, { txId: txId, type: 'Cancel', level: 'higher' });
  }, [txId, navigation.navigate, cancelDisabled]);

  const handlePressSpeedUp = useCallback(() => {
    navigation.navigate(SpeedUpStackName, { txId: txId, type: 'SpeedUp', level: 'higher' });
  }, [txId, navigation.navigate]);

  return (
    <View style={[styles.btnArea, containerStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: cancelDisabled ? colors.buttonFourth : pressed ? colors.underlay : 'transparent',
            borderColor: cancelDisabled ? colors.buttonLineThird : colors.borderPrimary,
          },
        ]}
        onPress={handlePressCancel}
      >
        <Text style={[styles.btnText, { color: cancelDisabled ? colors.textSecondary : colors.textPrimary }]}>{t('common.cancel')}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? colors.underlay : 'transparent', borderColor: colors.borderPrimary }]}
        onPress={handlePressSpeedUp}
      >
        <Text style={[styles.btnText, { color: colors.textPrimary }]}>{t('tx.action.speedUpBtn')}</Text>
        <RocketIcon style={styles.rocket} color={colors.iconPrimary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 34,
    borderWidth: 1,
    borderRadius: 4,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  rocket: {
    marginLeft: 2,
    transform: [{ translateY: 1 }],
  },
});

export default SpeedUpButton;
