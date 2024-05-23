import { Interface } from '@ethersproject/abi';
import ERC721 from './ABI/ERC721';
import ERC777 from './ABI/ERC777';
import ERC1155 from './ABI/ERC1155';
import ERC1155PresetMinterPauser from './ABI/ERC1155PresetMinterPauser';
import ERC721PresetMinterPauserAutoId from './ABI/ERC721PresetMinterPauserAutoId';
import ERC20PresetMinterPauser from './ABI/ERC20PresetMinterPauser';
export const iface721 = new Interface(ERC721);
export const iface777 = new Interface(ERC777);
export const iface1155 = new Interface(ERC1155);

export const iface1155PresetMinterPauser = new Interface(ERC1155PresetMinterPauser);
export const iface721PresetMinterPauserAutoId = new Interface(ERC721PresetMinterPauserAutoId);
export const iface20PresetMinterPauser = new Interface(ERC20PresetMinterPauser);
