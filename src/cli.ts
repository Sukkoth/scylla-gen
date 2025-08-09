import { Command } from 'commander';
import { generateTypesAndMappers } from './generate';
import { formatModels } from './format';
import { inspectModels } from './inspect';

const program = new Command();

program
  .name('scylla-gen')
  .description('CLI to generate Cassandra models')
  .version('0.0.1');

program
  .command('generate')
  .description('Generate Cassandra models')
  .option(
    '-f, --format',
    'Format models after generation using local prettier in your project'
  )
  .option('-m, --models <names...>', 'Model names (space or comma separated)')
  .action(async (options) => {
    const normalizedModels = Array.from(
      new Set(
        (options.models || [])
          .flatMap((m: string) => m.split(','))
          .map((m: string) => m.trim())
          .filter(Boolean)
      )
    );

    await generateTypesAndMappers();

    if (options.format) {
      await formatModels();
    }
    process.exit(0);
  });

program
  .command('inspect')
  .argument('<table_names...>', 'Table name(s), single or multiple')
  .option('-k, --keyspace <keyspace>', 'Keyspace name')
  .description('Inspect Cassandra models for one or more tables')
  .action(async (tableNames: string[], options) => {
    await inspectModels(tableNames, options.keyspace);
    process.exit(0);
  });

program
  .command('format')
  .description('Format models using local prettier')
  .action(async () => {
    await formatModels();
    process.exit(0);
  });

export default program;
