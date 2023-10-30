import BSIMSDK, { CoinTypes } from '@core/BSIMSDK';
import { createPrivateKeyVault, createHDVault, createBSIMVault } from '@core/DB/models/Vault/service';
import { addHexPrefix } from '@core/utils/base';
import { type RootStackList } from '@router/configs';
import { computeAddress } from 'ethers';

const createVaultWithRouterParams = async (args?: RootStackList['Biometrics']) => {
  if (args?.type === 'importPrivateKey' && args.value) {
    return await createPrivateKeyVault(args.value);
  }
  if (args?.type === 'importSeedPhrase' && args.type) {
    return await createHDVault(args.value);
  }
  if (args?.type === 'BSIM') {
    BSIMSDK.create('BSIM');
    const BSIMKey = await BSIMSDK.genNewKey(CoinTypes.CONFLUX);
    const pubkey = addHexPrefix(BSIMKey.key.substring(46, 176));
    const hexAddress = computeAddress(pubkey);
    return await createBSIMVault({ hexAddress: hexAddress, index: `${BSIMKey.index}` });
  }

  return await createHDVault();
};
export default createVaultWithRouterParams;