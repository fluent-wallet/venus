import ArrowDownward from '@assets/icons/arrow-downward.svg';
import ArrowUpward from '@assets/icons/arrow-upward.svg';
import Buy from '@assets/icons/buy.svg';
import Explore from '@assets/icons/explorer.svg';
import More from '@assets/icons/more.svg';
import Button from '@components/Button';
import Text from '@components/Text';
import { ASSET_TYPE } from '@core/types';
import { useTheme } from '@react-navigation/native';
import {
  type HomeStackName,
  ReceiveStackName,
  SendTransactionStackName,
  SendTransactionStep1StackName,
  type StackScreenProps,
  TooManyPendingStackName,
} from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { isPendingTxsFull } from '@service/transaction';
import { useMutation } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import type React from 'react';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import MoreOption from './MoreOption';

export const Navigation: React.FC<{
  title: string;
  Icon: ComponentProps<typeof Button>['Icon'];
  onPress?: VoidFunction;
  disabled?: boolean;
  testId?: string;
}> = ({ title, Icon, onPress, disabled, testId }) => {
  const { colors } = useTheme();

  return (
    <Pressable style={styles.navigation} onPress={onPress} disabled={disabled} testID={testId}>
      <Button testID={title} square size="small" Icon={Icon} onPress={onPress} disabled={disabled} />
      <Text style={[styles.navigationText, { color: disabled ? colors.iconThird : colors.textPrimary }]}>{title}</Text>
    </Pressable>
  );
};

const Navigations: React.FC<{
  navigation: StackScreenProps<typeof HomeStackName>['navigation'];
}> = ({ navigation }) => {
  const { t } = useTranslation();
  const { data: currentAddress } = useCurrentAddress();
  const addressId = currentAddress?.id ?? '';

  const assetsQuery = useAssetsOfCurrentAddress();

  const tokensEmpty = useMemo(() => {
    if (!addressId) return null;
    if (assetsQuery.isLoading) return null;
    if (assetsQuery.error) return null;

    const assets = assetsQuery.data ?? [];
    const tokens = assets.filter((asset) => asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20);
    if (tokens.length === 0) return true;

    return tokens.every((asset) => {
      try {
        // `IAsset.balance` is a decimal string (e.g. "0.01"), so BigInt is not applicable here.
        return new Decimal(asset.balance ?? '0').lte(0);
      } catch {
        return true;
      }
    });
  }, [addressId, assetsQuery.data, assetsQuery.error, assetsQuery.isLoading]);

  const { mutate: checkPendingTxLimit, isPending: isCheckingPendingTxLimit } = useMutation({
    mutationFn: async (id: string) => {
      if (!id) return false;
      return await isPendingTxsFull(id);
    },
    onSuccess: (full) => {
      if (full) {
        navigation.navigate(TooManyPendingStackName);
        return;
      }
      navigation.navigate(SendTransactionStackName, {
        screen: SendTransactionStep1StackName,
      });
    },
  });

  return (
    <View style={styles.container}>
      <Navigation
        title={t('home.send')}
        testId="send"
        Icon={ArrowUpward}
        onPress={() => checkPendingTxLimit(addressId)}
        disabled={tokensEmpty !== false || isCheckingPendingTxLimit}
      />
      <Navigation title={t('home.receive')} testId="receive" Icon={ArrowDownward} onPress={() => navigation.navigate(ReceiveStackName)} />
      <Navigation title={t('home.explore')} testId="explore" Icon={Explore} onPress={() => Linking.openURL('https://cfxmap.com')} />
      <MoreOption>
        <Navigation title={t('home.more')} testId="more" Icon={More} />
      </MoreOption>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navigation: {
    flex: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  navigationText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
});

export default Navigations;
