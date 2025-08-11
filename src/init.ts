import path from 'path';
import { writeFileSafely } from './utils';

export async function init() {
  const filePath = path.resolve(process.cwd(), 'src/models/db-client.ts');

  console.log('Initializing scylla-gen...');
  await writeClient(filePath);
  const relativePath = 'src/models/db-client.ts';
  const absolutePath = path.resolve(process.cwd(), relativePath);

  console.log(
    `DB client is initialized at \x1b]8;;file://${absolutePath}\x07${relativePath}\x1b]8;;\x07`,
  );

  process.exit(0);
}

async function writeClient(filePath: string) {
  const content = `import cassandra from 'cassandra-driver';

export const dbClient = new cassandra.Client({
  contactPoints: process.env.DB_CONTACT_POINTS?.split(','),
  keyspace: process.env.DB_DEFAULT_KEYSPACE,
  localDataCenter: process.env.DB_LOCAL_DATA_CENTER,
  credentials: {
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
  },
});
`;
  await writeFileSafely(filePath, content);
}
