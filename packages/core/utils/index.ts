import { ABI_777, ABI_721, ABI_1155 } from '../Consts/tokenAbi';
import { Interface } from '@ethersproject/abi';

export const iface777 = new Interface(ABI_777);
export const iface721 = new Interface(ABI_721);
export const iface1155 = new Interface(ABI_1155);
