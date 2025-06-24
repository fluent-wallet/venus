import 'reflect-metadata';
import { Container, inject, injectable } from 'inversify';
import type { IPlugin, PluginContext } from './plugin';
import { SERVICE_IDENTIFIER } from './service';
import type { EventBus } from './Events/eventTypes';

@injectable()
export class NewWalletCore {
  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  public eventBus!: EventBus;
}

export const createCore = (...plugins: IPlugin[]) => {
  const container = new Container({ defaultScope: 'Singleton' });

  const context: PluginContext = { container };

  container.bind(SERVICE_IDENTIFIER.CORE).to(NewWalletCore).inSingletonScope();

  for (const plugin of plugins) {
    console.log(`Using plugin: ${plugin.name}`);
    plugin.install(context);
  }

  return {
    bootstrap: async () => {
      console.log('Bootstrapping WalletCore...');
      for (const plugin of plugins) {
        if (plugin.afterInstall) {
          await plugin.afterInstall(context);
        }
      }
      console.log('WalletCore bootstrapped successfully!');

      return container.get<NewWalletCore>(SERVICE_IDENTIFIER.CORE);
    },
  };
};
