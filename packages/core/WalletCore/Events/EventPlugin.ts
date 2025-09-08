import type { IPlugin, PluginContext } from '../plugin';
import { SERVICE_IDENTIFIER } from '../service';
import { EventBusServer } from './eventServer';

const EventPlugin: IPlugin = {
  name: 'EventBus',
  install(context: PluginContext): void {
    context.container.bind(SERVICE_IDENTIFIER.EVENT_BUS).to(EventBusServer).inSingletonScope();
  },
  afterInstall(context: PluginContext): void {
    const eventBus: EventBusServer = context.container.get(SERVICE_IDENTIFIER.EVENT_BUS);
    eventBus.initializeSubscriptions();
  },
};

export { EventPlugin };
