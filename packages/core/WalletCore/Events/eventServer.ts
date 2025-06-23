import { Subject, type Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { injectable } from 'inversify';
import type { AllEventTypes, EventBus, EventObject, EventSchema, GetEvent, GetPayload } from './eventTypes';

@injectable()
export class EventBusServer<TSchema extends EventSchema = EventSchema> implements EventBus<TSchema> {
  private eventSubject = new Subject<EventObject<TSchema>>();

  public dispatch<T extends AllEventTypes<TSchema>>(
    ...args: GetPayload<TSchema, T> extends undefined ? [type: T, payload?: undefined] : [type: T, payload: GetPayload<TSchema, T>]
  ): void {
    const [type, payload] = args;
    this.eventSubject.next({ type, payload } as EventObject<TSchema>);
  }

  public on<T extends AllEventTypes<TSchema>>(type: T): Observable<GetPayload<TSchema, T>> {
    return this.eventSubject.asObservable().pipe(
      filter((event): event is GetEvent<TSchema, T> => event.type === type),
      map((event) => event.payload),
    );
  }
}
