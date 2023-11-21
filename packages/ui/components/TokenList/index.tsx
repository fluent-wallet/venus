import { useEffect } from 'react';
import { FlatList } from 'react-native';
import { firstValueFrom } from 'rxjs';
import { useAtom } from 'jotai';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';
import { nativeAndERC20tokenListAtom, AccountTokenListItem, requestTokenList } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';

import TokenItem from './TokenItem';

const TokenList: React.FC<{ onPress?: (v: AccountTokenListItem) => void }> = ({ onPress }) => {
  const [tokenList, setTokenList] = useAtom(nativeAndERC20tokenListAtom);
  const currentAddress = useCurrentAddress();

  useEffect(() => {
    if (!currentAddress) return;
    firstValueFrom(requestTokenList(currentAddress.hex, TokenType.ERC20)).then((list) => {
      setTokenList(list);
    });
  }, [setTokenList, currentAddress]);

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
