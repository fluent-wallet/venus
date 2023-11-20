import { Subject } from 'rxjs';

export enum LifeCycle {
  Setup = 'Setup',
  Ready = 'Ready',
  Destroy = 'Destroy',
}

export const lifecycleChangedSubject = new Subject<LifeCycle>();
lifecycleChangedSubject.next(LifeCycle.Setup);
