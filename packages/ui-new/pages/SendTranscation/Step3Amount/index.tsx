import React, { useState, useMemo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { formatUnits } from 'ethers';
import { useCurrentNetwork, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import plugins from '@core/WalletCore/Plugins';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import useFormatBalance from '@hooks/useFormatBalance';
import { SendTranscationStep3StackName, SendTranscationStep4StackName, type SendTranscationScreenProps } from '@router/configs';
import BackupBottomSheet from '../SendTranscationBottomSheet';
import { AccountItemView } from '@modules/AccountsList';

const SendTranscationStep3Amount: React.FC<SendTranscationScreenProps<typeof SendTranscationStep3StackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const currentNetwork = useCurrentNetwork()!;

  const [amount, setAmount] = useState('');

  const balance = useFormatBalance(route.params.asset.balance, route.params.asset.decimals);
  const symbol = useMemo(() => {
    if (!route.params.nftItemDetail) {
      return route.params.asset.symbol;
    } else return getDetailSymbol(route.params.nftItemDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickMax = useCallback(async () => {
    if (route.params.asset.type !== AssetType.Native) {
      if (route.params.nftItemDetail) {
        setAmount(route.params.nftItemDetail.amount);
      } else {
        setAmount(formatUnits(route.params.asset.balance, route.params.asset.decimals));
      }
    } else {
      plugins.Transaction.getTxProvider
      setAmount(formatUnits(route.params.asset.balance, route.params.asset.decimals));
    }
  }, []);

  const Suffix = useCallback(
    () => (
      <View style={styles.suffix}>
        <TokenIcon style={styles.assetIcon} source={(route.params.nftItemDetail ?? route.params.asset).icon} />
        <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
        <Pressable style={({ pressed }) => [styles.maxBtn, { backgroundColor: pressed ? colors.underlay : 'transparent' }]} onPress={handleClickMax}>
          <Text style={[styles.text, { color: colors.textPrimary, borderColor: colors.textPrimary }]}>Max</Text>
        </Pressable>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <BackupBottomSheet onClose={navigation.goBack}>
      <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>To</Text>
      <AccountItemView nickname={''} addressValue={route.params.targetAddress} colors={colors} mode={mode} />

      <Text style={[styles.text, styles.amount, { color: colors.textSecondary }]}>Amount</Text>
      <TextInput
        keyboardType="numeric"
        containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
        showVisible={false}
        defaultHasValue={false}
        value={amount}
        onChangeText={(newNickName) => setAmount(newNickName?.trim())}
        isInBottomSheet
        showClear={!!amount}
        placeholder={route.params.asset.type === AssetType.ERC1155 ? '0' : '0.00'}
        SuffixIcon={<Suffix />}
      />
      <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={3}>
        Balance: {route.params.nftItemDetail ? route.params.nftItemDetail.amount : balance} {symbol}
      </Text>

      <Button style={styles.btn} mode="auto">
        Next
      </Button>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
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
  textinput: {
    marginHorizontal: 16,
    paddingRight: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  balance: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  assetIcon: {
    width: 24,
    height: 24,
  },
  suffix: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  maxBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 34,
    borderWidth: 1,
    borderRadius: 6,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default SendTranscationStep3Amount;
