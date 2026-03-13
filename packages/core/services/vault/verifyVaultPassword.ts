import type { Database } from '@core/database';
import type { Vault } from '@core/database/models/Vault';
import TableName from '@core/database/TableName';
import type { CryptoTool } from '@core/types/crypto';
import { VaultType } from '@core/types/vault';

export async function verifyVaultPassword(params: { database: Database; cryptoTool: CryptoTool; password: string }): Promise<boolean> {
  const { database, cryptoTool, password } = params;
  const vaults = await database.get<Vault>(TableName.Vault).query().fetch();

  const softwareVaults = vaults.filter(
    (vault) => (vault.type === VaultType.HierarchicalDeterministic || vault.type === VaultType.PrivateKey) && Boolean(vault.data),
  );

  if (softwareVaults.length > 0) {
    for (const vault of softwareVaults) {
      const encryptedData = vault.data;
      if (!encryptedData) continue;

      try {
        await cryptoTool.decrypt(encryptedData, password);
        return true;
      } catch {
        // Try the next vault snapshot.
      }
    }

    return false;
  }

  const bsimVaults = vaults.filter((vault) => vault.type === VaultType.BSIM && Boolean(vault.data));
  for (const vault of bsimVaults) {
    const encryptedData = vault.data;
    if (!encryptedData) continue;

    try {
      const marker = await cryptoTool.decrypt<string>(encryptedData, password);
      if (marker === 'BSIM Wallet') return true;
    } catch {
      // Try the next vault snapshot.
    }
  }

  return false;
}
