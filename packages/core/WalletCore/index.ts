import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import '../database/setup';
import { Plugins } from './plugins';
import { Methods } from './methods';
import { container } from './configs';

@injectable()
export class WalletCore {
  @inject(Plugins) plugins!: Plugins;
  @inject(Methods) methods!: Methods;
}

container.bind(WalletCore).to(WalletCore);
export default container.get(WalletCore) as WalletCore;
