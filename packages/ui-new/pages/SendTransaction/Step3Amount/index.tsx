import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';
import Text from '@components/Text';
import Button from '@components/Button';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import { AccountItemView } from '@modules/AccountsList';
import { SendTransactionStep3StackName, SendTransactionStep4StackName, type SendTransactionScreenProps } from '@router/configs';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import SetAssetAmount from './SetAssetAmount';

const SendTransactionStep3Amount: React.FC<SendTransactionScreenProps<typeof SendTransactionStep3StackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  return (
    <SendTransactionBottomSheet>
      {route.params.nftItemDetail && (
        <>
          <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>Send</Text>
          <NFT colors={colors} asset={route.params.asset} nftItemDetail={route.params.nftItemDetail} />
        </>
      )}

      <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>To</Text>
      <AccountItemView nickname={''} addressValue={route.params.targetAddress} colors={colors} />
      <SetAssetAmount
        targetAddress={route.params.targetAddress}
        asset={route.params.asset}
        nftItemDetail={route.params.nftItemDetail}
        defaultAmount={route.params.amount}
      >
        {({ amount, validMax, isAmountValid, inEstimate, handleEstimateMax }) => (
          <Button
            testID="next"
            style={styles.btn}
            disabled={validMax !== null && isAmountValid !== true}
            onPress={validMax === null ? () => handleEstimateMax() : () => navigation.navigate(SendTransactionStep4StackName, { ...route.params, amount })}
            size="small"
            loading={inEstimate}
          >
            {validMax === null ? 'Estimate Max' : 'Next'}
          </Button>
        )}
      </SetAssetAmount>
    </SendTransactionBottomSheet>
  );
};

export const NFT: React.FC<{ colors: ReturnType<typeof useTheme>['colors']; asset: AssetInfo; nftItemDetail: NFTItemDetail }> = ({
  colors,
  asset,
  nftItemDetail,
}) => (
  <View style={styles.nftItem}>
    <NFTIcon style={styles.nftItemImg} source={nftItemDetail.icon} isNftItem placeholderContentFit="cover" contentFit="cover" />
    <Text style={[styles.nftAssetName, { color: colors.textSecondary }]}>{asset.name}</Text>
    <Text style={[styles.nftItemName, { color: colors.textPrimary }]}>{getDetailSymbol(nftItemDetail)}</Text>
  </View>
);

const styles = StyleSheet.create({
  nftItem: {
    marginTop: 14,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: 60,
    paddingLeft: 92,
    paddingRight: 16,
  },
  nftItemImg: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 60,
    height: 60,
    borderRadius: 2,
  },
  nftAssetName: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },
  nftItemName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  to: {
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  amount: {
    marginTop: 22,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default SendTransactionStep3Amount;
