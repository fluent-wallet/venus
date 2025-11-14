import type { Container } from 'inversify';

export interface PluginContext {
  container: Container;
}

export interface IPlugin {
  name: string;

  install(context: PluginContext): void;

  afterInstall?(context: PluginContext): Promise<void> | void;
}
