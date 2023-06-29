import Vault from './Vault';
import Token20 from './Token20';
import initDatabase from './Controller/initDatabase';
import {getNetworks, getAccountGroups} from './Query';
import Transaction from './Transaction';

import Balance from './Balance';
import {
  CFX_TESTNET_RPC_ENDPOINT,
  CFX_TESTNET_NETID,
  CFX_TESTNET_CHAINID,
} from './Consts/network';
// // 初始化数据库
initDatabase();
/* *************************************************************** */
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
// 把tokenList 的token 添加到数据库里
const token20 = new Token20();
token20.initTokenToCurrentNetwork();
/* *************************************************************** */

// get native balance
// const balance = new Balance({
//   endpoint: CFX_TESTNET_RPC_ENDPOINT,
//   networkId: CFX_TESTNET_NETID,
//   networkType: 'cfx',
// });
// balance.getNativeBalance('cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2');

/* *************************************************************** */

// 发送 cfx native 交易
const tran = new Transaction({
  endpoint: CFX_TESTNET_RPC_ENDPOINT,
  password: '2222aaa',
  network: {
    networkType: 'cfx',
    chainId: CFX_TESTNET_CHAINID,
    netId: CFX_TESTNET_NETID,
    id: 'bkk3avxofb7iusrc',
  },
});

// tran.sendCfxTransaction({
//   tx: {
//     from: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//     to: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//     value: 0,
//     chainId: CFX_TESTNET_CHAINID,
//   },
// });
