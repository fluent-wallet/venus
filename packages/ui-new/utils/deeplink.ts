import plugins from '@core/WalletCore/Plugins';

export function parseDeepLink(url: string) {
  if (url.startsWith('wc:')) {
    return plugins.WalletConnect.connect({ wcURI: url });
  }

  console.warn('this deep link is not supported yet: ', url);
}
