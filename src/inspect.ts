import { DB_DEFAULT_KEYSPACE } from './constants';
import { highlightSyntax } from './highlight-syntax';
import { fetchTableSchemas } from './service/db-service';
import { TableDefinition } from './types';

// Format and print CREATE TABLE statement
function printTableDefinition(
  table: TableDefinition,
  keyspace: string,
): string {
  const { tableName, columns } = table;

  // Partition and clustering keys
  const partitionKeys = columns
    .filter((row) => row.kind === 'partition_key')
    .sort((a, b) => a.position - b.position)
    .map((row) => row.column_name);
  const clusteringKeys = columns
    .filter((row) => row.kind === 'clustering')
    .sort((a, b) => a.position - b.position)
    .map((row) => row.column_name);

  // Format PRIMARY KEY
  const partitionKeysString =
    partitionKeys.length > 1
      ? `(${partitionKeys.join(', ')})`
      : partitionKeys.join(', ');
  const primaryKey = `PRIMARY KEY (${partitionKeysString}${
    clusteringKeys.length ? ', ' : ''
  }${clusteringKeys.join(', ')})`;

  // Format CLUSTERING ORDER BY
  const orderBy = columns
    .filter((row) => row.kind === 'clustering')
    .sort((a, b) => a.position - b.position)
    .map((row) => `${row.column_name} ${row.clustering_order}`)
    .join(', ');
  const clusteringOrder = orderBy
    ? ` WITH CLUSTERING ORDER BY (${orderBy})`
    : '';

  // Build CREATE TABLE statement
  const output = [
    `CREATE TABLE ${keyspace}.${tableName} (`,
    ...columns.map((row) => `  ${row.column_name} ${row.type},`),
    `  ${primaryKey}`,
    `)${clusteringOrder};`,
  ].join('\n');

  return output;
}

// Main function to inspect models
export async function inspectModels(
  tableNames?: string | string[],
  keyspaceToFetch?: string,
): Promise<void> {
  // Normalize input to array
  const tables = Array.isArray(tableNames)
    ? tableNames
    : tableNames
      ? [tableNames]
      : undefined;

  const keyspace = keyspaceToFetch ?? DB_DEFAULT_KEYSPACE;

  if (!keyspace) {
    console.error(
      'No keyspace provided. Please provide a keyspace or set DB_DEFAULT_KEYSPACE environment variable',
    );
    process.exit(1);
  }

  const tableDefinitions = await fetchTableSchemas(keyspace, tables);

  if (!tableDefinitions.length) {
    console.error(`No tables found in keyspace ${keyspace}`);
    process.exit(1);
  }

  // Print each table definition
  tableDefinitions.forEach((table) => {
    highlightSyntax(printTableDefinition(table, keyspace), 'sql');
    console.log(); // Add newline between tables
  });
}
