import database from '../Database';

class Network {
  async setCurrentNetwork(currentId, nextId) {
    const currentNetwork = await database.get('network').find(currentId);
    const nextNetwork = await database.get('network').find(nextId);
    return database.write(async () => {
      await database.batch(
        currentNetwork.prepareUpdate(() => {
          currentNetwork.selected = false;
        }),
        nextNetwork.prepareUpdate(() => {
          nextNetwork.selected = true;
        }),
      );
    });
  }
}

export default Network;
