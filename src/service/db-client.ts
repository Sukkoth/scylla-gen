import cassandra from 'cassandra-driver';
import {
  DB_CONTACT_POINTS,
  DB_DEFAULT_KEYSPACE,
  DB_USERNAME,
  DB_PASSWORD,
  DB_LOCAL_DATA_CENTER,
} from '../constants';

export const dbClient = new cassandra.Client({
  contactPoints: DB_CONTACT_POINTS?.split(','),
  keyspace: DB_DEFAULT_KEYSPACE,
  localDataCenter: DB_LOCAL_DATA_CENTER,
  credentials: {
    username: DB_USERNAME!,
    password: DB_PASSWORD!,
  },
});
