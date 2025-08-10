import cassandra from 'cassandra-driver';

const contactPointsRaw = process.env.SCYLLA_CONTACT_POINTS;
const keyspace = process.env.SCYLLA_DEFAULT_KEYSPACE;
const localDataCenter = process.env.SCYLLA_DATA_CENTER;

if (!contactPointsRaw) {
  throw new Error('SCYLLA_CONTACT_POINTS env variable is not set');
}

if (!keyspace) {
  throw new Error('SCYLLA_DEFAULT_KEYSPACE env variable is not set');
}

if (!localDataCenter) {
  throw new Error('SCYLLA_DATA_CENTER env variable is not set');
}

export const cassandraClient = new cassandra.Client({
  contactPoints: contactPointsRaw.split(','),
  keyspace,
  localDataCenter,
});
