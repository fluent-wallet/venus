import type { IPlugin, PluginContext } from '../plugin';
import { SERVICE_IDENTIFIER } from '../service';
import { EventBusServer } from './eventServer';

export class EventPlugin implements IPlugin {
  name = 'EventBus';
  install(context: PluginContext): void {
    context.container.bind(SERVICE_IDENTIFIER.EVENT_BUS).to(EventBusServer).inSingletonScope();
  }
}
