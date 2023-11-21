import { FlatList } from 'react-native';
import { useAtom } from 'jotai';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { nativeAndERC20tokenListAtom, AccountTokenListItem, requestTokenList } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';

import TokenItem from './TokenItem';

const TokenList: React.FC<{ onPress?: (v: AccountTokenListItem) => void }> = ({ onPress }) => {
  const [tokenList] = useAtom(nativeAndERC20tokenListAtom);

  return tokenList === null ? (
    <TokenItem placeholder={true} />
  ) : (
    <FlatList
      className="flex flex-1 px-6 py-4"
      data={tokenList}
      renderItem={({ item }) => <TokenItem placeholder={false} data={item} onPress={onPress ? onPress : undefined} />}
    />
  );
};

export default TokenList;
