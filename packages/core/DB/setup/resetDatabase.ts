import database from '../';

const resetDatabase = async () => {
  try {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  } catch (error) {
    console.error('Reset database error', error);
  }
}
export default resetDatabase;