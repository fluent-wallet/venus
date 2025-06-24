import { NewWalletCore } from '../core/WalletCore/index.new';
import { injectable } from 'inversify';

@injectable()
class WalletCoreExtends extends NewWalletCore {}

export const core = new WalletCoreExtends();
