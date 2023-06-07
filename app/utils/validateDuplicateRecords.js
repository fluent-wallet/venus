import {Q} from '@nozbe/watermelondb';
import database from '../Database';
const getDuplicatesByContent = async (tableName, contentName, content) => {
  return database.get(tableName).query(Q.where(contentName, Q.eq(content)));
};

export {getDuplicatesByContent};
