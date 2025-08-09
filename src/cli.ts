#!/usr/bin/env node
import 'dotenv/config';
import { generateTypesAndMappers } from './generate';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  try {
    await generateTypesAndMappers();
    console.log('Model generation completed!');

    // Run Prettier and wait for it to finish
    await execAsync(
      'pnpm prettier --write "src/cassandra-models/**/*.{ts,js}"'
    );

    console.log('Formatting completed!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
