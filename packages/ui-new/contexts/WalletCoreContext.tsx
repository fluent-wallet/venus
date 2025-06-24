import type { WalletCoreExtends } from '@WalletCoreExtends/index';
import { createContext } from 'react';

export const WalletCoreContext = createContext<WalletCoreExtends | null>(null);
