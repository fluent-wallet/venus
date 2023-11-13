import { VaultType, type Vault } from '../../database/models/Vault';
import { createVault, checkIsFirstVault, getVaultTypeCount } from '../../database/models/Vault/query';
import { createAccountGroup } from '../../database/models/AccountGroup/query';
import { generateMnemonic } from '../../utils/hdkey';
import { convertToCamelCase } from '../../database/react';
import { createAccount } from './createAccount';

const defaultGroupNameMap = {
  hierarchical_deterministic: 'Seed Phrase',
  private_key: 'Private Key',
  BSIM: 'BSIM',
  hardware: 'Hardware',
  public_address: 'Public Address',
} as const;

async function createVaultOfType(params: { type: VaultType.HierarchicalDeterministic; mnemonic: string }): Promise<void>;
async function createVaultOfType(params: { type: VaultType.PrivateKey; privateKey: string }): Promise<void>;
async function createVaultOfType(params: { type: VaultType.BSIM; accounts: Array<{ index: number; hexAddress: string }> }): Promise<void>;
async function createVaultOfType(params: { type: VaultType.Hardware; accounts: Array<{ index: number; hexAddress: string }> }): Promise<void>;
async function createVaultOfType(params: { type: VaultType.PublicAddress; hexAddress: string }): Promise<void>;
async function createVaultOfType({
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
        ? mnemonic!
        : type === VaultType.PrivateKey
        ? privateKey!
        : type === VaultType.PublicAddress
        ? hexAddress!
        : null;
    if ((type === VaultType.HierarchicalDeterministic || type === VaultType.PrivateKey || type === VaultType.PublicAddress) && !data) {
      throw new Error(`Create vault Error: vault type-${type} data can't be empty`);
    }
    const isFirstVault = await checkIsFirstVault();
    const count = await getVaultTypeCount(type);
    const vault = await createVault({ type, device: 'ePayWallet', ...(data ? { data } : null) });

    const accountGroup = await createAccountGroup({ nickname: `${defaultGroupNameMap[type]} - ${count + 1}`, hidden: false, vault });
    if (type === 'BSIM' || type === 'hardware') {
      if (!Array.isArray(accounts)) throw new Error(`Create vault Error: vault type-${type} accounts is not an array`);
      await Promise.all(
        accounts.map(({ index, hexAddress }, i) =>
          createAccount({
            selected: isFirstVault && i === 0 ? true : false,
            hidden: false,
            accountGroup,
            hexAddress,
            index,
          })
        )
      );
    } else {
      await createAccount({
        nickname: `${type === VaultType.HierarchicalDeterministic ? '' : `${convertToCamelCase(type)} `}Account - 1`,
        hidden: false,
        selected: isFirstVault ? true : false,
        accountGroup,
        ...(hexAddress ? { hexAddress } : null),
      });
    }
  } catch (error) {
    console.error('Create vault error: ', error);
  }
}

export const createHDVault = async (importMnemonic?: string) => {
  try {
    const start = performance.now();
    console.log('create hd vault start');
    const mnemonic = importMnemonic ?? (await generateMnemonic());
    await createVaultOfType({ type: VaultType.HierarchicalDeterministic, mnemonic });
    const end = performance.now();
    console.log(`create hd vault took ${end - start} ms.`);
  } catch (error) {
    console.error('create hd vault error: ', error);
  }
};

export const createBSIMVault = async (accounts: Array<{ index: number; hexAddress: string }>) => {
  try {
    const start = performance.now();
    console.log('create BSIM vault start');
    await createVaultOfType({ type: VaultType.BSIM, accounts });
    const end = performance.now();
    console.log(`create BSIM vault a Wallet took ${end - start} ms.`);
  } catch (error) {
    console.error('create BSIM vault error: ', error);
  }
};

export const createPrivateKeyVault = async (privateKey: string) => {
  try {
    const start = performance.now();
    console.log('create privateKey vault start');
    await createVaultOfType({ type: VaultType.PrivateKey, privateKey });
    const end = performance.now();
    console.log(`create privateKey vault a Wallet took ${end - start} ms.`);
  } catch (error) {
    console.error('create privateKey vault error: ', error);
  }
};

export const createPublicAddressVault = async (hexAddress: string) => {
  try {
    const start = performance.now();
    console.log('create publicAddress vault start');
    await createVaultOfType({ type: VaultType.PublicAddress, hexAddress });
    const end = performance.now();
    console.log(`create publicAddress vault a Wallet took ${end - start} ms.`);
  } catch (error) {
    console.error('create publicAddress vault error: ', error);
  }
};
