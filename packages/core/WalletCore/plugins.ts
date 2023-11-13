import { injectable } from 'inversify';
import { type Plugin, type CryptoToolPlugin } from '../plugins/Plugin';

export const PluginsSymbol = Symbol.for('Plugins');

export interface PluginsInterface {
  CryptoTool: CryptoToolPlugin;
}

@injectable()
export class Plugins implements PluginsInterface {
  public CryptoTool!: CryptoToolPlugin;

  public use(plugin: Plugin) {
    if (!plugin.name) throw new Error('Plugin must have a name');
  }
}
