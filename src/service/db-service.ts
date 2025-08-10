import { safeCall } from '../utils';
import { SchemaRow, TableDefinition } from '../types';
import { dbClient } from './db-client';
import { DB_DEFAULT_KEYSPACE } from '../constants';

/**
 * Fetch table schema definitions from Cassandra.
 *
 * @param keyspace - Keyspace name
 * @param tableNames - Table names to fetch (optional)
 * @returns Array of table definitions
 */
export async function fetchTableSchemas(
  keyspaceToFetch?: string,
  tableNames?: string[],
): Promise<TableDefinition[]> {
  const keyspace = keyspaceToFetch ?? DB_DEFAULT_KEYSPACE;

  if (!keyspace) {
    console.error(
      'No keyspace provided. Please provide a keyspace or set DB_DEFAULT_KEYSPACE environment variable',
    );
    process.exit(1);
  }

  const query = tableNames?.length
    ? `SELECT table_name, column_name, clustering_order, kind, position, type 
       FROM system_schema.columns 
       WHERE keyspace_name = '${keyspace}' 
       AND table_name IN (${tableNames.map(() => '?').join(', ')})`
    : `SELECT table_name, column_name, clustering_order, kind, position, type 
       FROM system_schema.columns 
       WHERE keyspace_name = '${keyspace}'`;

  const params = tableNames || [];

  const [error, result] = await safeCall(() =>
    dbClient.execute(query, params, { prepare: true }),
  );
  if (error) {
    console.error('Failed to fetch table schemas:', error.message);
    process.exit(1);
  }

  if (result.rowLength === 0) {
    console.error(`No tables found in keyspace ${keyspace}`);
    process.exit(1);
  }

  // Group rows by table name since the query returns all columns for all tables requested
  const tableMap = new Map<string, SchemaRow[]>();
  result?.rows.forEach((row: any) => {
    const schemaRow: SchemaRow = {
      table_name: row.table_name,
      column_name: row.column_name,
      clustering_order: row.clustering_order,
      kind: row.kind,
      position: row.position,
      type: row.type,
    };

    const tableName = schemaRow.table_name;
    if (!tableMap.has(tableName)) tableMap.set(tableName, []);
    tableMap.get(tableName)!.push(schemaRow);
  });

  const tables = Array.from(tableMap.entries()).map(([tableName, columns]) => ({
    tableName,
    columns,
  }));

  return tables;
}
