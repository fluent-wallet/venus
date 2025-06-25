import { Subject, type Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { injectable } from 'inversify';
import type { AllEventTypes, EventBus, EventObject, GetPayload } from './eventTypes';

@injectable()
export class EventBusServer implements EventBus {
  private eventSubject = new Subject<EventObject>();

  public dispatch<T extends AllEventTypes>(
    ...args: GetPayload<T> extends undefined ? [type: T, payload?: GetPayload<T>] : [type: T, payload: GetPayload<T>]
  ): void {
    const [type, payload] = args;
    this.eventSubject.next({ type, payload } as EventObject);
  }

  public on<T extends AllEventTypes>(type: T): Observable<GetPayload<T>> {
    return this.eventSubject.asObservable().pipe(
      filter((event): event is Extract<EventObject, { type: T }> => event.type === type),

      map((event) => event.payload),
    );
  }
}
