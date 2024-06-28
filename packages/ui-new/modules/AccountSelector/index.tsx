import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import AccountsList from '@modules/AccountsList';
import { useNavigation, useTheme } from '@react-navigation/native';
import { AccountManagementStackName, type HomeStackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
export type { BottomSheetMethods };

interface Props {
  onClose: () => void;
}

const AccountSelector: React.FC<Props> = ({ onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.percent75} index={0} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('common.account')}</Text>
          <Pressable
            testID="edit"
            style={({ pressed }) => [styles.edit, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => navigation.navigate(AccountManagementStackName)}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('common.edit')}</Text>
          </Pressable>
        </View>
        <AccountsList
          type="selector"
          disabledCurrent
          onPressAccount={({ accountId, isCurrent }) => {
            if (isCurrent) return;
            methods.selectAccount(accountId);
            bottomSheetRef?.current?.close();
          }}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  edit: {
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    top: 0,
    right: 0,
  },
});

export default AccountSelector;
