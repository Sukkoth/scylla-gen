export const DB_CONTACT_POINTS = process.env.DB_CONTACT_POINTS;
export const DB_DEFAULT_KEYSPACE = process.env.DB_DEFAULT_KEYSPACE;
export const DB_LOCAL_DATA_CENTER = process.env.DB_LOCAL_DATA_CENTER;
export const DB_USERNAME = process.env.DB_USERNAME;
export const DB_PASSWORD = process.env.DB_PASSWORD;

export const MAPPER = {
  ascii: 'string',
  bigint: 'number',
  blob: 'Buffer',
  boolean: 'boolean',
  counter: 'number',
  date: 'string',
  decimal: 'number',
  double: 'number',
  duration: 'string',
  float: 'number',
  inet: 'string',
  int: 'number',
  list: '[]',
  map: 'object',
  set: '[]',
  smallint: 'number',
  text: 'string',
  time: 'string',
  timestamp: 'Date',
  timeuuid: 'string',
  tinyint: 'number',
  tuple: 'tuple',
  uuid: 'string',
  varchar: 'string',
  varint: 'number',
  vector: 'vector',
};
