import React, { useCallback, type MutableRefObject } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import BottomSheet, { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Text from '@components/Text';
import AccountsList from '@modules/AccountsList';
export { type BottomSheet };

interface Props {
  accountSelectorRef: MutableRefObject<BottomSheet>;
}

const AccountSelector: React.FC<Props> = ({ accountSelectorRef }) => {
  const { colors } = useTheme();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />,
    [],
  );
  return (
    <BottomSheet
      ref={accountSelectorRef}
      index={-1}
      snapPoints={snapPoints}
      keyboardBlurBehavior="restore"
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Account</Text>
        </View>
        <AccountsList />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
});

const snapPoints = ['75%'];

export default AccountSelector;
