import BottomSheet, {
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTextInput,
  BottomSheetWrapper,
  snapPoints,
} from '@components/BottomSheet';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { StackNavigation } from '@router/configs';
import { useTranslation } from 'react-i18next';
import Text from '@components/Text';
import { Pressable, StyleSheet, View, type NativeSyntheticEvent, type TextInputChangeEventData } from 'react-native';
import Button from '@components/Button';
import { useCallback, useState } from 'react';
import methods from '@core/WalletCore/Methods';
import { NetworkType, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import ClearIcon from '@assets/icons/clear.svg';
import ErrorIcon from '@assets/icons/message-fail.svg';

const getChainIdMap = {
  [NetworkType.Conflux]: (endpoint: string) => fetchChain<{ chainId: string }>({ url: endpoint, method: 'cfx_getStatus' }).then((res) => res.chainId),
  [NetworkType.Ethereum]: (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'eth_chainId' }),
};

const AddNewEndpoint = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [netUrl, setNetUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const currentNetwork = useCurrentNetwork()!;
  const navigation = useNavigation<StackNavigation>();

  const handleChange = useCallback((event: NativeSyntheticEvent<TextInputChangeEventData>) => {
    setError('');
    setNetUrl(event.nativeEvent.text);
  }, []);

  const handleAdd = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const endpoint = new URL(netUrl);
      const request = getChainIdMap[currentNetwork?.networkType];

      try {
        const chainId = await request(endpoint.href);
        if (Number(chainId) !== Number(currentNetwork.chainId)) {
          setError(t('settings.network.add.invalidChainId'));
        } else {
          methods.addEndpoint({ network: currentNetwork.id, endpointParams: { endpoint: endpoint.href, type: 'outer' } });
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
      } catch (error) {
        console.log('request error', error);
        setError(t('settings.network.add.invalidURL'));
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.log('parse error', netUrl);
      setError(t('settings.network.add.invalidURL'));
    } finally {
      setLoading(false);
    }
  }, [netUrl, currentNetwork, t]);

  return (
    <BottomSheet snapPoints={snapPoints.percent40} index={0} isRoute>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('settings.network.add.title')} />

        <BottomSheetContent>
          <Text>{t('settings.network.add.subTitle')}</Text>

          <View style={[styles.flexRow, styles.inputContainer, { borderColor: error ? colors.down : colors.borderFourth }]}>
            <BottomSheetTextInput
              style={[styles.input, { color: error ? colors.down : colors.textPrimary }]}
              placeholder={t('settings.network.add.placeholder')}
              value={netUrl}
              onChange={handleChange}
            />
            <Pressable
              testID="clear"
              onPress={() => {
                setNetUrl('');
                setError('');
              }}
            >
              <ClearIcon width={24} height={24} color={colors.iconPrimary} />
            </Pressable>
          </View>
          {error && (
            <View style={[styles.flexRow, { marginTop: 6 }]}>
              <ErrorIcon width={24} height={24} color={colors.down} />
              <Text style={[styles.error, { color: colors.down }]}>{error}</Text>
            </View>
          )}
        </BottomSheetContent>

        <BottomSheetFooter>
          <Button loading={loading} disabled={!!error} testID="add" onPress={handleAdd}>
            {t('common.add')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  flexRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 6,
  },
  input: {
    fontSize: 16,
    fontWeight: '300',
    flex: 1,
  },
  error: {
    fontSize: 14,
    fontWeight: '300',
  },
});

export default AddNewEndpoint;
