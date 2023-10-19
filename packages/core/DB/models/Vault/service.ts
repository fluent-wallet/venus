import { type Vault } from './';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import { createAccountGroup } from '../AccountGroup/service';
import { createAccount } from '../Account/service';
import { generateMnemonic } from '../../../utils/hdkey';
import { cryptoTool } from '../../helper/cryptoTool';

type Params = ModelFields<Vault>;
export function createVault(params: Params, prepareCreate: true): Vault;
export function createVault(params: Params): Promise<Vault>;
export function createVault(params: Params, prepareCreate?: true) {
  return createModel<Vault>({
    name: TableName.Vault,
    params,
    prepareCreate,
  });
}

export const createHDVault = async () => {
  try {
    const start = performance.now();
    console.log('createHDVault start');
    const mnemonic = await generateMnemonic();
    const vault = await createVault({ data: await cryptoTool.encrypt(mnemonic), type: 'hierarchical_deterministic', device: 'ePayWallet' });
    const accountGroup = await createAccountGroup({ nickname: 'someAccountGroup', hidden: false, vault });
    await createAccount({ nickname: 'default', hidden: false, selected: false, accountGroup });
    const end = performance.now();
    console.log(`createHDVault a Wallet took ${end - start} ms.`);
  } catch (error) {
    console.error('createHDVault error: ', error);
  }
};
