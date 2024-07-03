import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/Text';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import RPCListItem from './RPCListItem';
import AddIcon from '@assets/icons/add.svg';
import { NetworkAddNewEndpointStackName, type StackNavigation } from '@router/configs';

const NetworkManagement = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const currentNetwork = useCurrentNetwork()!;
  const navigation = useNavigation<StackNavigation>();

  return (
    <View>
      <View style={[styles.warp, { borderColor: colors.borderFourth, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('settings.network.title')}</Text>

        <Text style={[styles.font14, styles.fontWeight300, styles.mb16, { color: colors.textSecondary }]}>{t('settings.network.networkName')}</Text>

        <Text style={[styles.font14, styles.fontWeight400, styles.mb24, { color: colors.textPrimary }]}>{currentNetwork?.name}</Text>

        <Text style={[styles.font14, styles.fontWeight300, styles.mb16, { color: colors.textSecondary }]}>{t('settings.network.chainId')}</Text>
        <Text style={[styles.font14, styles.fontWeight400, { color: colors.textPrimary }]}>{currentNetwork?.chainId}</Text>
      </View>

      <View style={styles.warp}>
        <View style={[styles.mb16, styles.flex, styles.flexRow, styles.justifyBetween]}>
          <Text style={[styles.font14, styles.fontWeight300, { color: colors.textSecondary }]}>{t('settings.network.RPCList')}</Text>
          <Pressable testID="add" onPress={() => navigation.navigate(NetworkAddNewEndpointStackName)}>
            <AddIcon width={24} height={24} color={colors.iconPrimary} />
          </Pressable>
        </View>

        <FlatList
          contentContainerStyle={{ gap: 10 }}
          extraData={currentNetwork?.endpointsList.length}
          data={currentNetwork?.endpointsList || []}
          renderItem={({ item }) => <RPCListItem rpc={item} currentNetwork={currentNetwork} />}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  warp: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 32,
  },
  font14: {
    fontSize: 14,
  },
  fontWeight300: {
    fontWeight: '300',
  },
  fontWeight400: {
    fontWeight: '400',
  },
  mb16: {
    marginBottom: 16,
  },
  mb24: {
    marginBottom: 24,
  },
  flex: {
    display: 'flex',
  },
  flexRow: {
    flexDirection: 'row',
  },
  justifyBetween: {
    justifyContent: 'space-between',
  },
});
export default NetworkManagement;
