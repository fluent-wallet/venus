import { createPrivateKeyVault, createHDVault } from "@core/DB/models/Vault/service";
import { type RootStackList } from "@router/configs";

const createVaultWithRouterParams = async (args?: RootStackList['Biometrics']) => {
  if (args?.type === 'importPrivateKey' && args.value) {
    return await createPrivateKeyVault(args.value);
  }
  if (args?.type === 'importSeedPhrase' && args.type) {
    return await createHDVault(args.value);
  }
  return await createHDVault();
};
export default createVaultWithRouterParams;