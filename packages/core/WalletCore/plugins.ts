import { injectable } from 'inversify';
import { container } from './configs';
import { type Plugin, type CryptoToolPlugin } from '../plugins/Plugin';

export interface PluginsInterface {
  CryptoTool: CryptoToolPlugin;
  [pluginName: string]: Plugin;
}

@injectable()
export class Plugins implements PluginsInterface {
  [pluginName: string]: Plugin;
  CryptoTool!: CryptoToolPlugin;

  public use(plugin: Plugin): void;
  public use(plugins: Array<Plugin>): void;
  public use(_plugins: Plugin | Array<Plugin>) {
    const plugins = Array.isArray(_plugins) ? _plugins : [_plugins];
    plugins.forEach((plugin) => {
      if (!plugin.name) throw new Error('Plugin must have a name');
      this[plugin.name] = plugin;
    });
  }
}

container.bind(Plugins).to(Plugins);
