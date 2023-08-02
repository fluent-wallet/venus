import {getCurrentNetwork} from '../Query';
import database from '../Database';

class Token20 {
  // add token to network

  _preCreateToken({network, ...rest}) {
    return database.get('token').prepareCreate(r => {
      for (const [key, value] of Object.entries(rest)) {
        r[key] = value;
        r.network.set(network);
      }
    });
  }

  async initTokenToCurrentNetwork() {
    const currentNetwork = await getCurrentNetwork();
    const isTokenInit = await database.localStorage.get(
      `is_${currentNetwork[0].chainId}_${currentNetwork[0].networkType}_token_init`,
    );
    if (isTokenInit || !currentNetwork) {
      return;
    }

    const tokenList = await currentNetwork[0].tokenList;
    const token = await fetch(tokenList.url).then(r => r.json());
    const tokenTableInstance = token.tokens.map(
      ({name, symbol, decimals, logoURI, address}) =>
        this._preCreateToken({
          network: currentNetwork[0],
          name,
          symbol,
          decimals,
          tokenAddress: address,
          logoURI,
          fromList: false,
          fromApp: false,
          fromUser: false,
        }),
    );

    await database.write(async () => {
      await database.batch(...tokenTableInstance);
    });

    await database.localStorage.set(
      `is_${currentNetwork[0].chainId}_${currentNetwork[0].networkType}_token_init`,
      'yes',
    );
  }
}

export default Token20;
