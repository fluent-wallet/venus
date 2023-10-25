import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { WalletStackName } from '@pages/Wallet';
import { ImportWalletStackName } from '@pages/ImportWallet';
import { AccountManageStackName } from '@pages/AccountManage';
import { NavigationProp } from '@react-navigation/native';

export type RootStackList = {
  [WelcomeStackName]: undefined;
  [SetPasswordStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create'; value?: string };
  [BiometricsStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create'; value?: string };
  [ImportWalletStackName]: undefined;
  [AccountManageStackName]: undefined;
  [WalletStackName]: undefined;

  Home: { screen: typeof WalletStackName };
};

export type StackNavigationType = NavigationProp<RootStackList>;
