import { Subject } from 'rxjs';
import { Singleton } from '../utils';
import { type Database } from '../../database';
import { type Account } from '../../database/models/Account';
import { type Network } from '../../database/models/Network';

class Events extends Singleton {
  private database: Database;
  constructor({ database }: { database: Database }) {
    super();
    this.database = database;
  }

  private networkChanged = new Subject<Network>();
  private accountChanged = new Subject<Account>();
}

export default Events.getInstance();
