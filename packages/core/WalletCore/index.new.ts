import 'reflect-metadata';
import { Container, injectable } from 'inversify';
import type { IPlugin, PluginContext } from './plugin';
import { SERVICE_IDENTIFIER, type ServiceKey, type ServiceType } from './service';
import type { EventBus } from './Events/eventTypes';

@injectable()
export class NewWalletCore {
  private container: Container;
  private context: PluginContext;
  private plugins: IPlugin[] = [];

  public constructor() {
    this.container = new Container({ defaultScope: 'Singleton' });
    this.context = { container: this.container };
  }

  private _eventBus: EventBus | null = null;
  get eventBus(): EventBus {
    if (!this._eventBus) {
      this._eventBus = this.getService(SERVICE_IDENTIFIER.EVENT_BUS);
    }
    return this._eventBus;
  }

  public use(plugin: IPlugin): this {
    console.log(`Using plugin: ${plugin.name}`);
    this.plugins.push(plugin);
    plugin.install(this.context);
    return this;
  }

  public async bootstrap(): Promise<void> {
    console.log('Bootstrapping WalletCore...');
    for (const plugin of this.plugins) {
      if (plugin.afterInstall) {
        await plugin.afterInstall(this.context);
      }
    }
    console.log('WalletCore bootstrapped successfully!');
  }

  public getService<K extends ServiceKey>(serviceKey: K): ServiceType<K> {
    return this.container.get(serviceKey) as ServiceType<K>;
  }
}
