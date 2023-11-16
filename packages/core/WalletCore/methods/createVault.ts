import { injectable, inject } from 'inversify';
import { Plugins } from '../plugins';
import { type Vault } from '../../database/models/Vault';
import { type Account } from '../../database/models/Account';
import { type Address } from '../../database/models/Address';
import VaultType from '../../database/models/Vault/VaultType';
import { createVault, checkIsFirstVault, getVaultTypeCount } from '../../database/models/Vault/query';
import { createAccountGroup } from '../../database/models/AccountGroup/query';
import { generateMnemonic } from '../../utils/hdkey';
import { AddAccountMethod, type Params as AddAccountParams } from './addAccount';
import database from '../../database';

const defaultGroupNameMap = {
  hierarchical_deterministic: 'Seed Phrase',
  private_key: 'Private Key',
  BSIM: 'BSIM',
  hardware: 'Hardware',
  public_address: 'Public Address',
} as const;

@injectable()
export class CreateVaultMethod {
  @inject(Plugins) plugins!: Plugins;

  @inject(AddAccountMethod) private AddAccountMethod!: AddAccountMethod;
  private addAccount(params: AddAccountParams & { vault: Vault }, prepareCreate: true): Promise<(Account | Address)[]>;
  private addAccount(params: AddAccountParams): Promise<Account>;
  private addAccount(...args: Parameters<AddAccountMethod['addAccount']>) {
    return this.AddAccountMethod.addAccount(...args) as any;
  }

  private async createVaultOfType(params: { type: VaultType.HierarchicalDeterministic; mnemonic: string }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.PrivateKey; privateKey: string }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.BSIM; accounts: Array<{ index: number; hexAddress: string }> }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.Hardware; accounts: Array<{ index: number; hexAddress: string }> }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.PublicAddress; hexAddress: string }): Promise<void>;
  private async createVaultOfType({
    type,
    mnemonic,
    privateKey,
    accounts,
    hexAddress,
  }: {
    type: Vault['type'];
    mnemonic?: string;
    privateKey?: string;
    accounts?: Array<{ index: number; hexAddress: string }>;
    hexAddress?: string;
  }) {
    try {
      const data =
        type === VaultType.HierarchicalDeterministic
          ? await this.plugins.CryptoTool.encrypt(mnemonic!)
          : type === VaultType.PrivateKey
          ? await this.plugins.CryptoTool.encrypt(privateKey!)
          : type === VaultType.PublicAddress
          ? hexAddress!
          : null;

      if ((type === VaultType.HierarchicalDeterministic || type === VaultType.PrivateKey || type === VaultType.PublicAddress) && !data) {
        throw new Error(`Create vault Error: vault type-${type} data can't be empty`);
      }
      const isFirstVault = await checkIsFirstVault();
      const count = await getVaultTypeCount(type);
      const vault = createVault({ type, device: 'ePayWallet', ...(data ? { data } : null) }, true);
      const accountGroup = createAccountGroup({ nickname: `${defaultGroupNameMap[type]} - ${count + 1}`, hidden: false, vault }, true);

      let batchs: Array<Array<Account | Address>>;
      if (type === 'BSIM' || type === 'hardware') {
        if (!Array.isArray(accounts)) throw new Error(`Create vault Error: vault type-${type} accounts is not an array`);
        batchs = await Promise.all(
          accounts.map(({ index, hexAddress }, i) =>
            this.addAccount(
              {
                vault,
                accountGroup,
                selected: isFirstVault && i === 0 ? true : false,
                hidden: false,
                hexAddress,
                index,
              },
              true
            )
          )
        );
      } else {
        batchs = [
          await this.addAccount(
            {
              vault,
              accountGroup,
              nickname: `${type === VaultType.HierarchicalDeterministic ? '' : `${convertToCamelCase(type)} `}Account - 1`,
              hidden: false,
              selected: isFirstVault ? true : false,
              ...(hexAddress ? { hexAddress } : null),
            },
            true
          ),
        ];
      }
      await database.write(async () => {
        await database.batch(vault, accountGroup, ...batchs.flat().flat());
      });
    } catch (error) {
      console.error('Create vault error: ', error);
    }
  }

  createHDVault = async (importMnemonic?: string) => {
    try {
      const start = performance.now();
      console.log('create hd vault start');
      const mnemonic = importMnemonic ?? (await generateMnemonic());
      await this.createVaultOfType({ type: VaultType.HierarchicalDeterministic, mnemonic });
      const end = performance.now();
      console.log(`create hd vault took ${end - start} ms.`);
    } catch (error) {
      console.error('create hd vault error: ', error);
    }
  };

  createBSIMVault = async (accounts: Array<{ index: number; hexAddress: string }>) => {
    try {
      const start = performance.now();
      console.log('create BSIM vault start');
      await this.createVaultOfType({ type: VaultType.BSIM, accounts });
      const end = performance.now();
      console.log(`create BSIM vault a Wallet took ${end - start} ms.`);
    } catch (error) {
      console.error('create BSIM vault error: ', error);
    }
  };

  createPrivateKeyVault = async (privateKey: string) => {
    try {
      const start = performance.now();
      console.log('create privateKey vault start');
      await this.createVaultOfType({ type: VaultType.PrivateKey, privateKey });
      const end = performance.now();
      console.log(`create privateKey vault a Wallet took ${end - start} ms.`);
    } catch (error) {
      console.error('create privateKey vault error: ', error);
    }
  };

  createPublicAddressVault = async (hexAddress: string) => {
    try {
      const start = performance.now();
      console.log('create publicAddress vault start');
      await this.createVaultOfType({ type: VaultType.PublicAddress, hexAddress });
      const end = performance.now();
      console.log(`create publicAddress vault a Wallet took ${end - start} ms.`);
    } catch (error) {
      console.error('create publicAddress vault error: ', error);
    }
  };
}

function convertToCamelCase(str: string) {
  return str.replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
}
