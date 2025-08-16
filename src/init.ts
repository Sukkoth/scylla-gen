import path from 'path';
import { writeFileSafely } from './utils';
import { dbModelContent, typeContent } from './content';

export async function init() {
  const dbClientFilePath = path.resolve(
    process.cwd(),
    'src/models/db-client.ts',
  );
  const typeFilePath = path.resolve(process.cwd(), 'src/models/types.ts');

  console.log('Initializing scylla-gen...');
  await writeClient(dbClientFilePath, dbModelContent);
  await writeClient(typeFilePath, typeContent);

  console.log(
    `DB client is initialized at \x1b]8;;file://${dbClientFilePath}\x07${dbClientFilePath}\x1b]8;;\x07`,
  );
  console.log(
    `Types are initialized at \x1b]8;;file://${typeFilePath}\x07${typeFilePath}\x1b]8;;\x07`,
  );

  process.exit(0);
}

async function writeClient(filePath: string, content: string) {
  await writeFileSafely(filePath, content);
}
