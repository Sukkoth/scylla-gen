#!/usr/bin/env node
import 'dotenv/config';
import { generateTypesAndMappers } from './generate';

async function main() {
  try {
    await generateTypesAndMappers();
    console.log('Model generation completed!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
