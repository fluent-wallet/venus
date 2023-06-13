import Vault from './Vault';
import Token20 from './Token20';
import initDatabase from './Controller/initDatabase';
import {getNetworks, getAccountGroups} from './Query';

initDatabase();

// 导入助记词/私

const importAccount = async () => {
  const networks = await getNetworks();
  const accountGroups = await getAccountGroups();
  const vault = new Vault({
    password: '2222aaa',
    mnemonic: '',
    networks,
    accountGroups,
  });
  vault.addVault();
};

// importAccount();
// add token
const token20 = new Token20();
// token20.initTokenToCurrentNetwork();
