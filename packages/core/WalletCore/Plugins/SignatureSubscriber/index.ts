import { broadcastSignatureSubject } from '@core/WalletCore/Events/broadcastSignatureSubject';
import { type Plugin } from '../';
import Methods from '@core/WalletCore/Methods';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    SignatureSubscriber: SignatureSubscriberPluginClass;
  }
}

class SignatureSubscriberPluginClass implements Plugin {
  public name = 'SignatureSubscriber';

  constructor() {
    this._setup();
  }

  private _setup() {
    broadcastSignatureSubject.subscribe(async (value) => {
      Methods.createSignature(value);
    });
  }
}

export default new SignatureSubscriberPluginClass();
