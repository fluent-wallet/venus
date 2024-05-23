import { type Signature } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

export type SignatureParams = Omit<ModelFields<Signature>, 'createdAt'>;
export function createSignature(params: SignatureParams, prepareCreate?: true) {
  return createModel<Signature>({ name: TableName.Signature, params, prepareCreate });
}
