import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { safeCallSync } from './utils';

export async function init() {
  const filePath = path.resolve(
    process.cwd(),
    'src/models/cassandra-client.ts'
  );

  console.log('Initializing scylla-gen...');
  await writeFileSafely(filePath);
  const relativePath = 'src/models/cassandra-client.ts';
  const absolutePath = path.resolve(process.cwd(), relativePath);

  console.log(
    `Cassandra Driver client is initialized at \x1b]8;;file://${absolutePath}\x07${relativePath}\x1b]8;;\x07`
  );

  process.exit(0);
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function writeFileSafely(filePath: string) {
  const content = `import cassandra from 'cassandra-driver';

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
});`;

  if (fs.existsSync(filePath)) {
    const answer = await askQuestion(
      `Cassandra client already exists. Overwrite? (y/N): `
    );
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  } else {
    // Ensure the parent directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const [error] = safeCallSync(() =>
    fs.writeFileSync(filePath, content, { flag: 'w' })
  );
  if (error) {
    console.error(`Error occurred while writing file: ${error.message}`);
    process.exit(1);
  }
}
