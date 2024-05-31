import { injectable } from 'inversify';
import { createApp as _createApp, queryAppByIdentity, type AppParams } from '../../database/models/App/query';

/**
 * Currently, apps are created in two ways.
 * One is when the built-in browser makes a requestAccounts request through the provider;
 * Two, when issuing a session_proposal via wallet-conenct.
 */
@injectable()
export class AppMethod {
  createApp = async (params: AppParams) => {
    const app = await this.queryAppByIdentity(params.identity);
    if (app !== null) {
      throw new Error('App already exist');
    }

    return _createApp(params);
  };

  queryAppByIdentity = async (identity: string) => {
    const apps = await queryAppByIdentity(identity);
    return apps?.[0] || null;
  };
}
