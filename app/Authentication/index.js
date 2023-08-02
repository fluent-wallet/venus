import {Platform} from 'react-native';
import * as KeyChain from 'react-native-keychain';
import Encrypt from '../utils/encrypt';

const encrypt = new Encrypt();

const defaultOptions = {
  service: 'com.fluent',
  authenticationPromptTitle: 'authentication.auth_prompt_title',
  authenticationPrompt: {title: 'authentication.auth_prompt_desc'},
  authenticationPromptDesc: 'authentication.auth_prompt_desc',
  fingerprintPromptTitle: 'authentication.fingerprint_prompt_title',
  fingerprintPromptDesc: 'authentication.fingerprint_prompt_desc',
  fingerprintPromptCancel: 'authentication.fingerprint_prompt_cancel',
};

const AUTHENTICATION_TYPE = {
  BIOMETRIC: 'biometrics',
  PASSCODE: 'device_passcode',
  REMEMBER_ME: 'remember_me',
  PASSWORD: 'password',
  UNKNOWN: 'unknown',
};

// replace code in build config
const ENCRYPT_CODE = 'FLUENT_CODE';
class Authentication {
  constructor() {
    this.TYPES = {
      BIOMETRICS: 'BIOMETRICS',
      PASSCODE: 'PASSCODE',
      REMEMBER_ME: 'REMEMBER_ME',
    };
  }
  async encryptPassword(password) {
    return encrypt.encrypt(ENCRYPT_CODE, {password});
  }

  async decryptPassword(str) {
    return encrypt.decrypt(ENCRYPT_CODE, str);
  }

  async getGenericPassword() {
    const keyChainObject = await KeyChain.getGenericPassword(defaultOptions);
    console.log('keyChainObject', keyChainObject);
    if (keyChainObject.password) {
      const encryptedPassword = keyChainObject.password;
      const decrypted = await this.decryptPassword(encryptedPassword);
      keyChainObject.password = decrypted.password;
      return keyChainObject;
    }
    return null;
  }

  async setGenericPassword(password, type) {
    const authOptions = {
      accessible: KeyChain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    };
    if (type === this.TYPES.BIOMETRICS) {
      authOptions.accessControl = KeyChain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET;
    } else {
      authOptions.accessControl = KeyChain.ACCESS_CONTROL.DEVICE_PASSCODE;
    }

    const encryptedPassword = await this.encryptPassword(password);

    console.log('encryptedPassword', encryptedPassword);
    await KeyChain.setGenericPassword('fluent-user', encryptedPassword, {
      ...defaultOptions,
      ...authOptions,
    });

    if (type === this.TYPES.BIOMETRICS) {
      // If the user enables biometrics, we're trying to read the password
      // immediately so we get the permission prompt
      if (Platform.OS === 'ios') {
        await this.getGenericPassword();
      }
    }
  }

  // stores a user password in the secure keyChain with a specific auth type
  storePassword = async ({password, authType}) => {
    switch (authType) {
      case AUTHENTICATION_TYPE.BIOMETRIC:
        await this.setGenericPassword(
          `${encrypt.generateRandomStr()}${new Date().getTime()}`,
          this.TYPES.BIOMETRICS,
        );
        break;
      case AUTHENTICATION_TYPE.PASSCODE:
        await this.setGenericPassword(password, this.TYPES.PASSCODE);
        break;
      case AUTHENTICATION_TYPE.REMEMBER_ME:
        await this.setGenericPassword(password, this.TYPES.REMEMBER_ME);
        break;
      case AUTHENTICATION_TYPE.PASSWORD:
        await this.setGenericPassword(password, undefined);
        break;
      default:
        await this.setGenericPassword(password, undefined);
        break;
    }
  };

  // remove the username/password combination from the secure storage.
  async resetGenericPassword() {
    const options = {service: defaultOptions.service};
    return KeyChain.resetGenericPassword(options);
  }
  /**
   * @description:validate password
   * @param {*} inputPassword user input password when authType is not biometrics
   * @param {*} authType phone supported biometry type
   * @return {*}
   */
  async validatePassword({inputPassword, authType}) {
    try {
      const credentials = await this.getGenericPassword();
      const password = credentials?.password;
      if (password === null) {
        return false;
      }
      if (authType === AUTHENTICATION_TYPE.BIOMETRIC) {
        return !!password;
      } else {
        return inputPassword === password;
      }
    } catch (e) {
      throw e;
    }
  }
}

export default Authentication;
