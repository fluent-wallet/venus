import { BehaviorSubject, filter } from 'rxjs';

export const nextNonceSubjectPush = new BehaviorSubject<string | null>(null);

export const nextNonceSubject = nextNonceSubjectPush.pipe(filter((v) => v !== null));
