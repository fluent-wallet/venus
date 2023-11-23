import { injectable } from 'inversify';
import { container } from '../configs';

export interface Plugin {
  name: string;
}

export interface CryptoToolPlugin extends Plugin {
  name: 'CryptoTool';
  encrypt(object: unknown): Promise<string>;
  decrypt<T = unknown>(encryptedDataString: string): Promise<T>;
}

@injectable()
export class Plugins {
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

container.bind(Plugins).to(Plugins).inSingletonScope();
export default container.get(Plugins) as Plugins;
