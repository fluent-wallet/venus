import React, { useCallback, useRef, type RefObject } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import AccountsList from '@modules/AccountsList';
import Text from '@components/Text';
// import BottomSheet, { BottomSheetView, snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import BottomSheet, { BottomSheetView, snapPoints, type BottomSheetMethods } from '@components/BottomSheetNew';
import { AccountManagementStackName, HomeStackName, type StackScreenProps } from '@router/configs';
export { type BottomSheetMethods };

interface Props {
  selectorRef?: RefObject<BottomSheetMethods>;
}

const AccountSelector: React.FC<Props> = ({ selectorRef }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const handleSelect = useCallback(() => {
    bottomSheetRef?.current?.close();
  }, []);

  return (
    <BottomSheet snapPoints={snapPoints.percent75} isRoute={!selectorRef}>
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Account</Text>
          <Pressable
            style={({ pressed }) => [styles.edit, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => navigation.navigate(AccountManagementStackName)}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>⚙️ Edit</Text>
          </Pressable>
        </View>
        <AccountsList type="selector" onPressAccount={handleSelect} />
      </BottomSheetView>
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
