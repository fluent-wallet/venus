import {convertValueToData} from '@fluent-wallet/data-format';
import Vault from './Vault';
import Token20 from './Token20';
import NFT from './NFT';
import initDatabase from './Controller/initDatabase';
import {getNetworks, getAccountGroups, getAccountGroupVault} from './Query';
import Transaction from './Transaction';
import {iface721} from './utils';
import Balance from './Balance';
import Account from './Account';
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
import Network from './Network';
// // 初始化数据库 app 一启动就要调用这个方法。把我们预设的数据的信息写入进来
// initDatabase();
/* *************************************************************** */
// 导入助记词/私
// const importAccount = async () => {
//   const networks = await getNetworks();
//   const accountGroups = await getAccountGroups();
//   const vault = new Vault({
//     password: '2222aaa',
//     mnemonic: '',
//     // pk: '',
//     networks,
//     accountGroups,
//   });
//   vault.addVault();
// };

// importAccount();

// 1.把tokenList 的token 添加到数据库里。这个方法和initDatabase 一样 只要app 启动就要调用一下
// 2.他必须在initDatabase 成功之后 才能调用。在写业务代码的时候注意下。
// const token20 = new Token20();
// token20.initTokenToCurrentNetwork();
/* *************************************************************** */

// const balance = new Balance({
//   endpoint: CFX_TESTNET_RPC_ENDPOINT,
//   netId: CFX_TESTNET_NETID,
//   networkType: 'cfx',
// });
// get native balance
// balance.getNativeBalance('cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2');
// get 20 token balance
// balance.getTokenBalances({
//   userAddress: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//   tokenAddress: [
//     'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv',
//     'cfxtest:achkx35n7vngfxgrm7akemk3ftzy47t61yk5nn270s',
//     'cfxtest:achde4ppjn11tntcd1dcynhze9puwfc73en8mnvzvg',
//     'cfxtest:acceftennya582450e1g227dthfvp8zz1p370pvb6r',
//   ],
//   checkerAddress: 'cfxtest:achxne2gfh8snrstkxn0f32ua2cf19zwkyw9tpbc6k',
// });
// balance.getTokenBalance({
//   userAddress: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//   tokenAddress: 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv',
// });
// 当前地址是否有余额
// balance.hasBalance({
//   userAddress: 'cfxtest:aamx6vj8avtza17s92tsd5sr77mvtw7rparkba6px2',
//   tokenAddress: [
//     'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv',
//     'cfxtest:achkx35n7vngfxgrm7akemk3ftzy47t61yk5nn270s',
//     'cfxtest:achde4ppjn11tntcd1dcynhze9puwfc73en8mnvzvg',
//     'cfxtest:acceftennya582450e1g227dthfvp8zz1p370pvb6r',
//   ],
//   checkerAddress: 'cfxtest:achxne2gfh8snrstkxn0f32ua2cf19zwkyw9tpbc6k',
// });

/* *************************************************************** */

// 发送 cfx native 交易
// const tran = new Transaction({
//   endpoint: CFX_TESTNET_RPC_ENDPOINT,
//   password: '2222aaa',
//   network: {
//     networkType: 'cfx',
//     chainId: CFX_TESTNET_CHAINID,
//     netId: CFX_TESTNET_NETID,
//     id: 'aalbcq7qnms1pg4a',
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
/* *************************************************************** */

// 发送erc721 nft

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

// const data = iface721.encodeFunctionData('safeTransferFrom', [
//   '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
//   '0x89c40eDe78315D654aB7B4c53496c51F9A9f7641',
//   convertValueToData('66218'),
// ]);

// tran.sendTransaction({
//   tx: {
//     from: '0x72CF63232D3b55e4Cd7B209067679b8f90d6B0EA',
//     to: '0xc36442b4a4522e871399cd717abdd847ab11fe88',
//     value: 0,
//     chainId: ETH_GOERLI_CHAINID,
//     data,
//   },
// });
/* *************************************************************** */

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
/* *************************************************************** */

//账户 账户组
// const account = new Account();
// 修改账户组的名字
// account.updateAccountGroupName({
//   nickname: 'hh',
//   accountGroupId: 'u708oyxd0ly7qq7m',
// });
// 修改账户名字
// account.updateAccountName({nickname: 'ss', accountId: 'r8bw1ppp5207dfqz'});
// 在账户组下面添加一个账户
// account.addAccount({
//   accountGroupId: 'u708oyxd0ly7qq7m',
//   password: '2222aaa',
// });
// 导出助记词
// account.getMnemonic({accountGroupId: 'u708oyxd0ly7qq7m', password: '2222aaa'});

// 导出私钥
// account.getPrivateKey({addressId: '44ai2j8npy9s9m2x', password: '2222aaa'});
// “删除” account
// account.deleteAccount({
//   accountGroupId: 'u708oyxd0ly7qq7m',
//   accountId: 'r8bw1ppp5207dfqz',
// });
// 删除所有账户相关的数据
// account.eraseAllAccounts();

/* *************************************************************** */

// 网络相关
// const network = new Network();
// network.setCurrentNetwork('0uk9j83awl6j1z9o', '3rq1hngwwpf6rbsu');
