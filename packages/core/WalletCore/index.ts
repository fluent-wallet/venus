import 'reflect-metadata';
import '../database/setup';
import { Container } from 'inversify';
import database, { type Database } from '../database';
export { Database };

class WalletCore {
  private static instance: WalletCore;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  public static getInstance(): WalletCore {
    if (!WalletCore.instance) {
      WalletCore.instance = new WalletCore();
    }
    return WalletCore.instance;
  }

  public run() {
    console.log(123);
  }
}

export const databaseSymbol = Symbol.for('Database');
const container = new Container({ defaultScope: 'Singleton' });
container.bind<Database>(databaseSymbol).toConstantValue(database);

export default WalletCore.getInstance();
