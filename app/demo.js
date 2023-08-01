import {convertValueToData} from '@fluent-wallet/data-format';
import Vault from './Vault';
import Token20 from './Token20';
import NFT from './NFT';
import initDatabase from './Controller/initDatabase';
import {getNetworks, getAccountGroups, getAccountGroupVault} from './Query';
import Transaction from './Transaction';
import {iface721} from './utils';

import Balance from './Balance';
import {
  CFX_TESTNET_RPC_ENDPOINT,
  CFX_TESTNET_NETID,
  CFX_TESTNET_CHAINID,
  ETH_GOERLI_RPC_ENDPOINT,
  ETH_GOERLI_NETID,
  ETH_GOERLI_CHAINID,
  CFX_ESPACE_TESTNET_RPC_ENDPOINT,
  CFX_ESPACE_TESTNET_CHAINID,
  CFX_ESPACE_TESTNET_NETID,
} from './Consts/network';
// // 初始化数据库
// initDatabase();
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
// const token20 = new Token20();
// token20.initTokenToCurrentNetwork();
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
// const tran = new Transaction({
//   endpoint: CFX_TESTNET_RPC_ENDPOINT,
//   password: '2222aaa',
//   network: {
//     networkType: 'cfx',
//     chainId: CFX_TESTNET_CHAINID,
//     netId: CFX_TESTNET_NETID,
//     id: 'o0jc3amn1bpawuxy',
//   },
// });

// tran.sendTransaction({
//   tx: {
//     from: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//     to: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//     value: 0,
//     chainId: CFX_TESTNET_CHAINID,
//   },
// });

// 发送eth交易
// const tran = new Transaction({
//   endpoint: ETH_GOERLI_RPC_ENDPOINT,
//   password: '2222aaa',
//   network: {
//     networkType: 'eth',
//     chainId: ETH_GOERLI_CHAINID,
//     netId: ETH_GOERLI_NETID,
//     id: 'hn0k83c016yei6jm',
//   },
// });

// tran.sendTransaction({
//   tx: {
//     from: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
//     to: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
//     value: 0,
//     chainId: ETH_GOERLI_CHAINID,
//   },
// });

// 发送erc721 nft

const tran = new Transaction({
  endpoint: ETH_GOERLI_RPC_ENDPOINT,
  password: '2222aaa',
  network: {
    networkType: 'eth',
    chainId: ETH_GOERLI_CHAINID,
    netId: ETH_GOERLI_NETID,
    id: 'hn0k83c016yei6jm',
  },
});

const data = iface721.encodeFunctionData('safeTransferFrom', [
  '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
  '0x89c40eDe78315D654aB7B4c53496c51F9A9f7641',
  convertValueToData('66218'),
]);

// tran.sendTransaction({
//   tx: {
//     from: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
//     to: '0xc36442b4a4522e871399cd717abdd847ab11fe88',
//     value: 0,
//     chainId: ETH_GOERLI_CHAINID,
//     data,
//   },
// });

//获取当前网络指定地址下的nft
// const nft = new NFT({
//   network: {
//     networkType: 'eth',
//     chainId: CFX_ESPACE_TESTNET_CHAINID,
//     netId: CFX_ESPACE_TESTNET_NETID,
//     endpoint: CFX_ESPACE_TESTNET_RPC_ENDPOINT,
//  isTestnet: true,
//   },
// });
// nft
//   .getCfxNftBalances({owner: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA'})
//   .then(res => {
//     nft
//       .getCfxNftTokenIds({
//         owner: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
//         contract: res?.list?.[0].contract,
//       })
//       .then(res => {
//         nft
//           .getCfxNftDetails({
//             contract: res?.list?.[0].contract,
//             tokenId: res?.list?.[0].tokenId,
//           })
//           .then(res => {
//             console.log('res3', res);
//           });
//         console.log('res2', res);
//       });
//     console.log('res1', res);
//   })
//   .catch(err => {
//     console.log('err', err);
//   });

// const nft = new NFT({
//   network: {
//     networkType: 'eth',
//     chainId: ETH_GOERLI_CHAINID,
//     netId: ETH_GOERLI_NETID,
//     endpoint: ETH_GOERLI_RPC_ENDPOINT,
//     isTestnet: true,
//   },
// });
// nft
//   .getEthNftBalances({owner: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA'})
//   .then(r => {
//     const item = r.assets[0];
//     console.log('item', item);
//     nft
//       .getETHhNftDetail({
//         contract: item.asset_contract.address,
//         tokenId: item.token_id,
//       })
//       .then(r => {
//         console.log('r2', r);
//       });
//     console.log('r', r);
//   })
//   .catch(e => {
//     console.log('e', e);
//   });
