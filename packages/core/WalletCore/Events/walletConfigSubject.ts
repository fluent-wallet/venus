import { BehaviorSubject, filter } from 'rxjs';
import type { WalletConfig } from '../Plugins/WalletConfig/consts';

export const walletConfigSubjectPush = new BehaviorSubject<WalletConfig | null>(null);

export const walletConfigSubject = walletConfigSubjectPush.pipe(filter((v) => v !== null));
