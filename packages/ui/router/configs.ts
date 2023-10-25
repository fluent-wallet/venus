
import { type NavigationProp } from '@react-navigation/native';
import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { WalletStackName } from '@pages/Wallet';
import { ImportWalletStackName } from '@pages/ImportWallet';
import { AccountManageStackName } from '@pages/Account/AccountManage';
export { AccountManageStackName  } from '@pages/Account/AccountManage';
export { ImportWalletStackName  } from '@pages/ImportWallet';
export { SetPasswordStackName  } from '@pages/SetPassword';
export { BiometricsStackName  } from '@pages/SetPassword/Biometrics';
export { SettingsStackName  } from '@pages/Settings';
export { WalletStackName  } from '@pages/Wallet';
export { WelcomeStackName  } from '@pages/Welcome';
export const HomeStackName = 'Home';

export type RootStackList = {
  [WelcomeStackName]: undefined;
  [SetPasswordStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create'; value?: string };
  [BiometricsStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create'; value?: string };
  [ImportWalletStackName]: undefined;
  [AccountManageStackName]: undefined;
  [WalletStackName]: undefined;

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
