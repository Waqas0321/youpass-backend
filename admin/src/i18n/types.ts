export type DeepStringRecord<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: DeepStringRecord<T[K]> }
    : never;
