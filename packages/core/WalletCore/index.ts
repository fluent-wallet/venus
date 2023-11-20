import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Plugins } from './Plugins';
import { Methods } from './Methods';
import { Events } from './Events';
import { container } from './configs';
import { initDatabase } from '../database/func';
import { LifeCycle } from './Events/lifecycleChanged';

@injectable()
export class WalletCore {
  @inject(Plugins) plugins!: Plugins;
  @inject(Methods) methods!: Methods;
  @inject(Events) events!: Events;
  public LifeCycle = LifeCycle;

  async setup() {
    try {
      await initDatabase();
      await this.events.lifecycleChangedSubject.next(LifeCycle.Ready);
    } catch (error) {
      console.log('WalletCore setup error: ', error);
    }
  }
}

container.bind(WalletCore).to(WalletCore);
export default container.get(WalletCore) as WalletCore;
