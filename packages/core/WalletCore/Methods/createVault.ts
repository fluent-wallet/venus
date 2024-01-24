import { injectable, inject } from 'inversify';
import { Plugins } from '../Plugins';
import { Vault } from '../../database/models/Vault';
import { type Account } from '../../database/models/Account';
import { type Address } from '../../database/models/Address';
import VaultType from '../../database/models/Vault/VaultType';
import { createVault, checkIsFirstVault, getVaultTypeCount } from '../../database/models/Vault/query';
import { createAccountGroup } from '../../database/models/AccountGroup/query';
import { generateMnemonic } from '../../utils/hdkey';
import { AddAccountMethod, type Params as AddAccountParams } from './addAccount';
import database from '../../database';
import VaultSourceType from '@core/database/models/Vault/VaultSourceType';

const defaultGroupNameMap = {
  [VaultType.HierarchicalDeterministic]: 'Seed Phrase',
  [VaultType.PrivateKey]: 'Private Key',
  [VaultType.BSIM]: 'BSIM',
  [VaultType.Hardware]: 'Hardware',
  [VaultType.PublicAddress]: 'Public Address',
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

  private async createVaultOfType(params: {
    type: VaultType.HierarchicalDeterministic;
    mnemonic: string;
    password?: string;
    isImportByUser?: boolean;
  }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.PrivateKey; privateKey: string; password?: string; isImportByUser?: boolean }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.BSIM; accounts: Array<{ index: number; hexAddress: string }>; password?: string }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.Hardware; accounts: Array<{ index: number; hexAddress: string }> }): Promise<void>;
  private async createVaultOfType(params: { type: VaultType.PublicAddress; hexAddress: string }): Promise<void>;
  private async createVaultOfType({
    type,
    mnemonic,
    privateKey,
    accounts,
    hexAddress,
    password,
    isImportByUser = false,
  }: {
    type: Vault['type'];
    mnemonic?: string;
    privateKey?: string;
    accounts?: Array<{ index: number; hexAddress: string }>;
    hexAddress?: string;
    password?: string;
    isImportByUser?: boolean;
  }) {
    try {
      const data =
        type === VaultType.HierarchicalDeterministic
          ? await this.plugins.CryptoTool.encrypt(mnemonic!, password)
          : type === VaultType.PrivateKey
            ? await this.plugins.CryptoTool.encrypt(privateKey!, password)
            : type === VaultType.PublicAddress
              ? hexAddress!
              : type === VaultType.BSIM
                ? await this.plugins.CryptoTool.encrypt('BSIM Wallet', password)
                : null;

      if ((type === VaultType.HierarchicalDeterministic || type === VaultType.PrivateKey || type === VaultType.PublicAddress) && !data) {
        throw new Error(`Create vault Error: vault type-${type} data can't be empty`);
      }
      const isFirstVault = await checkIsFirstVault();
      const count = await getVaultTypeCount(type);
      const vault = createVault(
        {
          type,
          device: 'ePayWallet',
          ...(data ? { data } : null),
          source: isImportByUser ? VaultSourceType.IMPORT_BY_USER : VaultSourceType.CREATE_BY_WALLET,
          isBackup: false,
        },
        true,
      );
      const accountGroup = createAccountGroup({ nickname: `${defaultGroupNameMap[type]} - ${count + 1}`, hidden: false, vault }, true);

      let batches: Array<Array<Account | Address>>;
      if (type === 'BSIM' || type === 'hardware') {
        if (!Array.isArray(accounts)) throw new Error(`Create vault Error: vault type-${type} accounts is not an array`);
        batches = await Promise.all(
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
              true,
            ),
          ),
        );
      } else {
        batches = [
          await this.addAccount(
            {
              vault,
              accountGroup,
              nickname: type === VaultType.HierarchicalDeterministic ? undefined : `${convertToCamelCase(type)} Account - ${count + 1}`,
              hidden: false,
              selected: isFirstVault ? true : false,
              ...(hexAddress ? { hexAddress } : null),
              ...(type === VaultType.HierarchicalDeterministic || type === VaultType.PrivateKey
                ? { vaultData: type === VaultType.HierarchicalDeterministic ? mnemonic : privateKey }
                : null),
            },
            true,
          ),
        ];
      }
      await database.write(async () => {
        await database.batch(vault, accountGroup, ...batches.flat().flat());
      });
    } catch (error) {
      console.log('Create vault error: ', error);
      throw error;
    }
  }

  createHDVault = async (importMnemonic?: string, password?: string) => {
    const start = performance.now();
    console.log('create hd vault start');
    const mnemonic = importMnemonic ?? (await generateMnemonic());
    await this.createVaultOfType({ type: VaultType.HierarchicalDeterministic, mnemonic, password, isImportByUser: !!importMnemonic });
    const end = performance.now();
    console.log(`create hd vault took ${end - start} ms.`);
  };

  createBSIMVault = async (accounts: Array<{ index: number; hexAddress: string }>, password?: string) => {
    const start = performance.now();
    console.log('create BSIM vault start');
    await this.createVaultOfType({ type: VaultType.BSIM, accounts, password });
    const end = performance.now();
    console.log(`create BSIM vault a Wallet took ${end - start} ms.`);
  };

  createPrivateKeyVault = async (privateKey: string, password?: string) => {
    const start = performance.now();
    console.log('create privateKey vault start');
    await this.createVaultOfType({ type: VaultType.PrivateKey, privateKey, password, isImportByUser: true });
    const end = performance.now();
    console.log(`create privateKey vault a Wallet took ${end - start} ms.`);
  };

  createPublicAddressVault = async (hexAddress: string) => {
    const start = performance.now();
    console.log('create publicAddress vault start');
    await this.createVaultOfType({ type: VaultType.PublicAddress, hexAddress });
    const end = performance.now();
    console.log(`create publicAddress vault a Wallet took ${end - start} ms.`);
  };
}

function convertToCamelCase(str: string) {
  return str.replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
}
