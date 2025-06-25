import { EXTENDS_SERVICE_IDENTIFIER } from '@WalletCoreExtends/service';
import type { IPlugin } from '../../../core/WalletCore/plugin';
import { AuthenticationServer, type IAuthenticationServer } from './authenticationServer';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';

const AuthenticationPlugin: IPlugin = {
  name: EXTENDS_SERVICE_IDENTIFIER.AUTHENTICATION,
  install(context) {
    context.container.bind(EXTENDS_SERVICE_IDENTIFIER.AUTHENTICATION).to(AuthenticationServer).inSingletonScope();
  },
  afterInstall(context) {
    const cryptoToolPlugin: ICryptoTool = context.container.get(SERVICE_IDENTIFIER.CRYPTO_TOOL);
    const authenticationPlugin: IAuthenticationServer = context.container.get(EXTENDS_SERVICE_IDENTIFIER.AUTHENTICATION);
    cryptoToolPlugin.setGetPasswordMethod(authenticationPlugin.getPassword);
  },
};

export { AuthenticationPlugin };
