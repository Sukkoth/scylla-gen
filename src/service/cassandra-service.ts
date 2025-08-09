import { cassandraClient } from '../cassandra-driver';
import { safeCall } from '../utils';
import { SchemaRow, TableDefinition } from '../types';

export async function fetchTableSchemas(
  tableNames?: string[]
): Promise<[Error | null, TableDefinition[]]> {
  const query = tableNames?.length
    ? `SELECT table_name, column_name, clustering_order, kind, position, type 
       FROM system_schema.columns 
       WHERE keyspace_name = 'messaging_service' 
       AND table_name IN (${tableNames.map(() => '?').join(', ')})`
    : `SELECT table_name, column_name, clustering_order, kind, position, type 
       FROM system_schema.columns 
       WHERE keyspace_name = 'messaging_service'`;
  const params = tableNames || [];

  const [error, result] = await safeCall(() =>
    cassandraClient.execute(query, params, { prepare: true })
  );
  if (error) return [error, []];

  // Group rows by table name
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

  return [null, tables];
}
