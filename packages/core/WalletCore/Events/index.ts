import { injectable } from 'inversify';
import { container } from '../configs';
import { lifecycleChangedSubject } from './lifecycleChanged';
import { accountChangedSubject } from './accountChanged';
import { addressChangedSubject } from './addressChanged';
import { networkChangedSubject } from './networkChanged';

export interface Event {
  name: string;
}

@injectable()
export class Events {
  public lifecycleChangedSubject = lifecycleChangedSubject;
  public accountChangedSubject = accountChangedSubject;
  public addressChangedSubject = addressChangedSubject;
  public networkChangedSubject = networkChangedSubject;
}

container.bind(Events).to(Events);
export default container.get(Events) as Events;
