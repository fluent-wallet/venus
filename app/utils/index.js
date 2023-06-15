import database from '../Database';
import Encrypt from './encrypt';

const encrypt = new Encrypt();

export const camelCase = str => {
  return str.replace(/_([a-z])/g, function (match, group1) {
    return group1.toUpperCase();
  });
};

export const validateDuplicateVault = async (password, data) => {
  const records = await database.get('vault').query().fetch();
  let ret = false;
  if (records.length) {
    for (let i = 0; i < records.length; i++) {
      let {data: decryptData} = await encrypt.decrypt(
        password,
        records[i].data,
      );
      if (decryptData === data) {
        ret = true;
        break;
      }
    }
  }
  return ret;
};
