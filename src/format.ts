import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function formatModels() {
  console.log('Formatting models...');
  await execAsync('pnpm prettier --write "src/cassandra-models/**/*.{ts,js}"');
  console.log('Formatted models!');
}
