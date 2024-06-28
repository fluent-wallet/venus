import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Events } from './Events';
import { LifeCycle } from './Events/lifecycleChanged';
import { Methods } from './Methods';
import { Plugins } from './Plugins';
import { container } from './configs';

@injectable()
export class WalletCore {
  @inject(Plugins) plugins!: Plugins;
  @inject(Methods) methods!: Methods;
  @inject(Events) events!: Events;
  public LifeCycle = LifeCycle;

  async setup() {
    try {
      if (this.methods.initDatabase) {
        await this.methods.initDatabase();
      } else {
        await this.methods.initDatabaseDefault();
      }
      await this.methods.rejectAllPendingRequests();
      await this.events.lifecycleChangedSubject.next(LifeCycle.Ready);
    } catch (error) {
      console.log('WalletCore setup error: ', error);
    }
  }
}

container.bind(WalletCore).to(WalletCore);
export default container.get(WalletCore) as WalletCore;
