export type EventSchema = [{ type: 'EVENT_BUS'; payload: undefined }];

export type AllEventTypes<TSchema extends EventSchema> = TSchema[number]['type'];

export type GetEvent<TSchema extends EventSchema, TType extends AllEventTypes<TSchema>> = Extract<TSchema[number], { type: TType }>;

export type GetPayload<TSchema extends EventSchema, TType extends AllEventTypes<TSchema>> = GetEvent<TSchema, TType>['payload'];

export type EventObject<TSchema extends EventSchema> = {
  [K in keyof TSchema]: {
    type: TSchema[K]['type'];
    payload: TSchema[K]['payload'];
  };
}[number];
