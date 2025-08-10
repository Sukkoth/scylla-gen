import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { safeCallSync } from './utils';

export async function init() {
  const filePath = path.resolve(process.cwd(), 'src/models/db-client.ts');

  console.log('Initializing scylla-gen...');
  await writeFileSafely(filePath);
  const relativePath = 'src/models/db-client.ts';
  const absolutePath = path.resolve(process.cwd(), relativePath);

  console.log(
    `DB client is initialized at \x1b]8;;file://${absolutePath}\x07${relativePath}\x1b]8;;\x07`,
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

  if (fs.existsSync(filePath)) {
    const answer = await askQuestion(
      `DB client already exists. Overwrite? (y/N): `,
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
    fs.writeFileSync(filePath, content, { flag: 'w' }),
  );
  if (error) {
    console.error(`Error occurred while writing file: ${error.message}`);
    process.exit(1);
  }
}
