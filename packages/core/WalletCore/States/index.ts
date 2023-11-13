import { from } from 'rxjs';
import { Singleton } from '../utils';
import { type Database } from '../../database';
import { type Account } from '../../database/models/Account';
import { querySelectedAccount } from '../../database/models/Account/service';
import { type Network } from '../../database/models/Network';
import { querySelectedNetwork } from '../../database/models/Network/service';

class State extends Singleton {
  private database: Database;
  private currentNetwork!: Network;
  private currentAccount!: Account;

  constructor({ database }: { database: Database }) {
    super();
    this.database = database;
    this.initState();
  }

  private async initState() {
    this.currentNetwork = (await querySelectedNetwork(this.database)).at(0)!;
    this.currentAccount = (await querySelectedAccount(this.database)).at(0)!;
  }


}

export default State.getInstance();
