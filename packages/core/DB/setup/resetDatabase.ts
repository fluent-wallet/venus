import database from '../';
import { initDatabase } from './initDatabase';

const resetDatabase = async () => {
  try {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    await initDatabase();
  } catch (error) {
    console.error('Reset database error', error);
  }
};

export default resetDatabase;
