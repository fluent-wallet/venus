import React, { type MutableRefObject } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import AccountsList from '@modules/AccountsList';
import Text from '@components/Text';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { AccountManagementStackName, HomeStackName, type StackScreenProps } from '@router/configs';
export { type BottomSheetMethods };

interface Props {
  selectorRef: MutableRefObject<BottomSheetMethods>;
}

const AccountSelector: React.FC<Props> = ({ selectorRef }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();

  return (
    <BottomSheet ref={selectorRef} snapPoints={snapPoints} isModal={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Account</Text>
          <Pressable
            style={({ pressed }) => [styles.edit, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => navigation.navigate(AccountManagementStackName)}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>⚙️ Edit</Text>
          </Pressable>
        </View>
        <AccountsList type="selector" onPressAccount={() => selectorRef.current?.close()} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 300,
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

const snapPoints = ['75%'];

export default AccountSelector;
