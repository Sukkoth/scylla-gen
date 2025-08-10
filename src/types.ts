import { MAPPER } from './constants';

// Interface for schema row to ensure type safety
export interface SchemaRow {
  table_name: string;
  column_name: string;
  clustering_order: string | null;
  kind: 'partition_key' | 'clustering' | 'regular';
  position: number;
  type: ColumnTypes;
}

// Interface for table definition
export interface TableDefinition {
  tableName: string;
  columns: SchemaRow[];
}

export type ColumnTypes = keyof typeof MAPPER;
