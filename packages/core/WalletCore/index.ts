import 'reflect-metadata';
import { inject, injectable } from 'inversify';

import { Methods } from './Methods';
import { Plugins } from './Plugins';
import { container } from './configs';

@injectable()
export class WalletCore {
  @inject(Plugins) plugins!: Plugins;
  @inject(Methods) methods!: Methods;

  async setup() {
    try {
      if (this.methods.initDatabase) {
        await this.methods.initDatabase();
      } else {
        await this.methods.initDatabaseDefault();
      }
      await this.methods.rejectAllPendingRequests();
    } catch (error) {
      console.log('WalletCore setup error: ', error);
    }
  }
}

container.bind(WalletCore).to(WalletCore);
export default container.get(WalletCore) as WalletCore;
