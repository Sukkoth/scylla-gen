import { exec } from 'child_process';
import { promisify } from 'util';
import { safeCall } from './utils';

const execAsync = promisify(exec);

export async function formatModels() {
  console.log('Formatting models...');
  const [error] = await safeCall(() =>
    execAsync('pnpm prettier --write "src/models/**/*.{ts,js}"'),
  );
  if (error) {
    console.error(
      'Make sure you have configured prettier in your project to use this feature',
    );
    process.exit(1);
  }
  console.log('Formatted models!');
}
