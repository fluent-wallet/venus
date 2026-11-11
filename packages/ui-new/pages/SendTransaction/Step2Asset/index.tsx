import { SheetHeader } from '@components/Sheet';
import { ASSET_TYPE } from '@core/types';
import AssetSelectorContent from '@modules/AssetSelector/AssetSelectorContent';
import { type SendTransactionStep2StackName, SendTransactionStep3StackName, SendTransactionStep4StackName, type StackScreenProps } from '@router/configs';
import type { INftItem } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

type Props = StackScreenProps<typeof SendTransactionStep2StackName>;

const SendTransactionStep2Asset: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const handleSelectAsset = useCallback(
    (asset: AssetInfo, nftItemDetail?: INftItem) => {
      const recipientAddress = route.params.recipientAddress;
      if (!recipientAddress) {
        return;
      }
      if ((asset.type === ASSET_TYPE.ERC20 || asset.type === ASSET_TYPE.Native) && (Number(asset.balance) === 0 || Number.isNaN(Number(asset.balance)))) {
        return showMessage({
          message: t('tx.asset.zeroBalance', { symbol: asset.symbol }),
          type: 'warning',
        });
      }
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
      if (asset.type === ASSET_TYPE.ERC721) {
        navigation.navigate(SendTransactionStep4StackName, {
          recipientAddress,
          asset,
          nftItemDetail,
          amount: '1',
        });
      } else {
        navigation.navigate(SendTransactionStep3StackName, {
          recipientAddress,
          asset,
          nftItemDetail,
        });
      }
    },
    [navigation, route.params.recipientAddress, t],
  );

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHeader title={t('tx.send.title')} style={styles.header} />
      <AssetSelectorContent selectType="Send" initialSearch={route.params.searchAddress} onSelectAsset={handleSelectAsset} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 0,
  },
});

export default SendTransactionStep2Asset;
