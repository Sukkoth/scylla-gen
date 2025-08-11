import { Command } from 'commander';
import { generateTypesAndMappers } from './generate';
import { formatModels } from './format';
import { inspectModels } from './inspect';
import { init } from './init';

const program = new Command();

program
  .name('scylla-gen')
  .description('CLI to generate table models for ScyllaDB/Cassandra')
  .version('0.0.1');

program
  .command('init')
  .description('Initialize DB client to connect to your cluster')
  .action(async () => {
    init();
  });

program
  .command('generate')
  .description('Generate models(object mappers) for your tables')
  .option(
    '--format',
    'Format models after generation using local prettier in your project',
  )
  .option(
    '-p, --print-only',
    'Print models to console instead of writing to file',
  )
  .option('-t, --tables <names...>', 'Table names (space or comma separated)')
  .option(
    '-k, --keyspace <keyspace>',
    'Select which keyspace to fetch the tables from (default from env will be used if not provided)',
  )
  .option(
    '-f, --force',
    'Force overwrite existing models without asking for confirmation',
  )
  .action(async (options) => {
    const tables: string[] = Array.from(
      new Set(
        (options.tables || [])
          .flatMap((m: string) => m.split(','))
          .map((m: string) => m.trim())
          .filter(Boolean),
      ),
    );

    await generateTypesAndMappers({
      tables,
      printOnly: options.printOnly,
      keyspace: options.keyspace,
      overwrite: options.force,
    });

    if (options.format) {
      await formatModels();
    }
    process.exit(0);
  });

program
  .command('inspect')
  .argument('<table_names...>', 'Table name(s), single or multiple')
  .option('-k, --keyspace <keyspace>', 'Keyspace name')
  .description('Inspect DDL for one or more tables')
  .action(async (tableNames: string[], options) => {
    await inspectModels(tableNames, options.keyspace);
    process.exit(0);
  });

program
  .command('format')
  .description('Format generated models using local prettier')
  .action(async () => {
    await formatModels();
    process.exit(0);
  });

export default program;
