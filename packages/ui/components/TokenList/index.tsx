import { FlatList, ActivityIndicator } from 'react-native';
import { useAtom } from 'jotai';
import { nativeAndERC20tokenListAtom, AccountTokenListItem, requestTokenList } from '@hooks/useTokenList';

import TokenItem from './TokenItem';
import { useTheme } from '@rneui/themed';

const TokenList: React.FC<{ onPress?: (v: AccountTokenListItem) => void }> = ({ onPress }) => {
  const { theme } = useTheme();
  const [tokenList] = useAtom(nativeAndERC20tokenListAtom);

  return tokenList === null ? (
    <ActivityIndicator color={theme.colors.contrastWhiteAndBlack} size={'large'} />
  ) : (
    <FlatList className="flex flex-1 px-6 py-4" data={tokenList} renderItem={({ item }) => <TokenItem data={item} onPress={onPress ? onPress : undefined} />} />
  );
};

export default TokenList;
