import { BottomSheetContent, BottomSheetHeader, type BottomSheetMethods, BottomSheetWrapper, InlineBottomSheet, snapPoints } from '@components/BottomSheet';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import AccountsList from '@modules/AccountsList';
import { useNavigation, useTheme } from '@react-navigation/native';
import { AccountManagementStackName, type HomeStackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
export type { BottomSheetMethods };

interface Props {
  onClose: () => void;
  isOpen?: boolean;
}

const AccountSelector: React.FC<Props> = ({ onClose, isOpen }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <InlineBottomSheet ref={bottomSheetRef} snapPoints={snapPoints.percent75} index={isOpen ? 0 : -1} onClose={onClose}>
      <BottomSheetWrapper>
        <BottomSheetHeader title={t('common.account')}>
          <Pressable
            testID="edit"
            style={({ pressed }) => [styles.edit, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => navigation.navigate(AccountManagementStackName)}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('common.edit')}</Text>
          </Pressable>
        </BottomSheetHeader>
        <BottomSheetContent>
          <AccountsList
            type="selector"
            disabledCurrent
            onPressAccount={({ accountId, isCurrent }) => {
              if (isCurrent) return;
              methods.selectAccount(accountId);
              bottomSheetRef?.current?.close();
            }}
          />
        </BottomSheetContent>
      </BottomSheetWrapper>
    </InlineBottomSheet>
  );
};

export const styles = StyleSheet.create({
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
    top: 12,
    right: 0,
  },
});

export default AccountSelector;
