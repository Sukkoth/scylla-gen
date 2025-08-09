import { fetchTableSchemas } from './service/cassandra-service';
import { TableDefinition } from './types';

// Format and print CREATE TABLE statement
function printTableDefinition(table: TableDefinition): string {
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
    `CREATE TABLE messaging_service.${tableName} (`,
    ...columns.map((row) => `  ${row.column_name} ${row.type},`),
    `  ${primaryKey}`,
    `)${clusteringOrder};`,
  ].join('\n');

  return output;
}

// Main function to inspect models
export async function inspectModels(
  tableNames?: string | string[]
): Promise<void> {
  // Normalize input to array
  const tables = Array.isArray(tableNames)
    ? tableNames
    : tableNames
    ? [tableNames]
    : undefined;

  const [error, tableDefinitions] = await fetchTableSchemas(tables);
  if (error) {
    console.error('Failed to fetch schema:', error.message);
    return;
  }

  if (!tableDefinitions.length) {
    console.error('No tables found in keyspace messaging_service');
    return;
  }

  // Print each table definition
  tableDefinitions.forEach((table) => {
    console.log(printTableDefinition(table));
    console.log(); // Add newline between tables
  });
}
