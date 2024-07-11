import NoRecord from '@assets/images/noRecord.webp';
import Text from '@components/Text';
import { useRecentlyAddress } from '@core/WalletCore/Plugins/ReactInject';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { AccountItemView } from '@modules/AccountsList';
import { styles as noneStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

const RecentlyList: React.FC<{
  onPressAddress: (addressValue: string) => void;
}> = ({ onPressAddress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const recentlyAddress = useRecentlyAddress();

  if (!recentlyAddress?.length) {
    return (
      <>
        <Image style={noneStyles.noneImg} source={NoRecord} contentFit="contain" />
        <Text style={[noneStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noRecord')}</Text>
      </>
    );
  }

  return (
    <BottomSheetFlatList
      style={styles.container}
      data={recentlyAddress}
      keyExtractor={(item) => item.addressValue}
      renderItem={({ item }) => (
        <AccountItemView colors={colors} nickname={item.nickname} addressValue={item.addressValue} onPress={() => onPressAddress(item.addressValue)} />
      )}
    />
  );
};

export const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  noRecentlyIcon: {
    marginTop: 24,
    marginBottom: 6,
    alignSelf: 'center',
  },
  noRecentlyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default RecentlyList;
