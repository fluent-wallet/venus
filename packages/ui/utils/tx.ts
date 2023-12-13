import { TxStatus } from '@core/database/models/Tx/type';

export const formatStatus = (status: TxStatus): 'failed' | 'pending' | 'confirmed' => {
  switch (status) {
    case '-2':
    case '-1':
      return 'failed';
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
      return 'pending';
    case '5':
      return 'confirmed';
    default:
      return ''  as never;
  }
};
