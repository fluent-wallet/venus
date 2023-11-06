import { createPrivateKeyVault, createHDVault, createBSIMVault } from '@core/DB/models/Vault/service';
import { connectBSIM } from '@core/BSIMSDK/service';
import { type RootStackList } from '@router/configs';

const createVaultWithRouterParams = async (args?: RootStackList['Biometrics']) => {
  if (args?.type === 'importPrivateKey' && args.value) {
    return await createPrivateKeyVault(args.value);
  }
  if (args?.type === 'importSeedPhrase' && args.type) {
    return await createHDVault(args.value);
  }
  if (args?.type === 'BSIM') {
    return await createBSIMVault(await connectBSIM());
  }

  return await createHDVault();
};

export default createVaultWithRouterParams;
