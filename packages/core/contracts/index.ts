import { Interface } from '@ethersproject/abi';
import ERC721 from './ABI/ERC721';
import ERC777 from './ABI/ERC777';
import ERC1155 from './ABI/ERC1155';

export const iface721 = new Interface(ERC721);
export const iface777 = new Interface(ERC777);
export const iface1155 = new Interface(ERC1155);
