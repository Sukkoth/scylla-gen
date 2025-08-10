import pluralize from 'pluralize';
import fs from 'fs/promises';
import path from 'path';
import {
  snakeToCamel,
  snakeToPascal,
  kebabCase,
  getToModel,
  highlightSyntax,
} from './utils';
import { fetchTableSchemas } from './service/db-service';
import { ColumnTypes, SchemaRow } from './types';
import { MAPPER } from './constants';

type Props = {
  tables: string[];
  printOnly?: boolean;
  keyspace?: string;
};
/**
 * Generate type definitions and mappers for the specified tables.
 *
 * @param tables - Table names to generate type definitions and mappers for
 * @param printOnly - If true, will print to console instead of writing to file
 * @param keyspace - Keyspace name to fetch table schemas from
 */
export async function generateTypesAndMappers({
  tables,
  printOnly,
  keyspace,
}: Props) {
  const tableSchemas = await fetchTableSchemas(keyspace, tables);

  /** Path to the models directory */
  const modelsDir = path.resolve(process.cwd(), 'src/models');
  /** Create the models directory if it doesn't exist */
  await fs.mkdir(modelsDir, { recursive: true });

  for (const table of tableSchemas) {
    const { tableName, columns } = table;
    const interfaceName = pluralize.singular(snakeToPascal(tableName));
    const fileName = kebabCase(interfaceName) + '.ts';

    /**
     * Build PartitionKeys type lines. All partition keys are required when
     * querying.
     */
    const partitionKeys = columns
      .filter((c) => c.kind === 'partition_key')
      .sort((a, b) => a.position - b.position);

    const partitionKeyTypeDefinition = partitionKeys.map((c) => {
      return `  ${snakeToCamel(c.column_name)}: ${
        MAPPER[c.type as ColumnTypes]
      };`;
    });

    /** Build ClusteringKeys union type */
    const clusteringKeys = columns
      .filter((c) => c.kind === 'clustering')
      .sort((a, b) => a.position - b.position); //sort by position in key definition

    /**
     * Build the `ClusteringKeys` union type.
     *
     * Given an ordered list of clustering keys, generate a union of object
     * types representing all valid prefix combinations in query order.
     *
     * For example, for clustering keys [a, b, c]:
     *
     * `type ClusteringKeys = { a: string } | { a: string; b: string } | { a:
     * string; b: string; c: string };`
     *
     * This reflects Cassandra's query rules: you can filter by the first key
     * alone, the first two keys, or all keys in order — but never skip a
     * preceding key.
     */

    let clusteringKeysTypeDefinition = '';
    if (clusteringKeys.length > 0) {
      const unions: string[] = [];

      for (let i = 1; i <= clusteringKeys.length; i++) {
        const keysSlice = clusteringKeys.slice(0, i);
        const typeLines = keysSlice
          .map(
            (c) =>
              `    ${snakeToCamel(c.column_name)}: ${
                MAPPER[c.type as ColumnTypes]
              };`,
          )
          .join('\n');
        unions.push(`  | {\n${typeLines}\n  }`);
      }
      clusteringKeysTypeDefinition = unions.join('\n');
    }

    /** Build content which defines the model */
    let content = '';

    /** Build imports */
    content += `import cassandra from 'cassandra-driver';\n`;
    content += `import { dbClient } from './db-client';\n\n`;

    /** Build interface for the columns */
    content += `export interface ${interfaceName} {\n`;
    for (const column of columns) {
      /**
       * If the column type is a collection type (e.g. list, set, map), generate
       * the type definition for the collection.
       */
      if (column.type.includes('<') && column.type.includes('>')) {
        if (column.type.includes('list') || column.type.includes('set')) {
          /**
           * Lists and sets are similar to arrays of numbers. The difference is
           * that lists are when order matters or duplicates are needed. and
           * sets are when you need a collection of unique elements without
           * order.
           */
          const matches = column.type.match(/<(.*)>/);
          const type = matches?.[1] ?? column.type;
          let typeLine = `  ${snakeToCamel(column.column_name)}: ${
            MAPPER[type as ColumnTypes] || 'unknown'
          }[];\n`;
          content += typeLine;
        } else if (column.type.includes('map')) {
          /** Maps are similar to objects in JavaScript. */
          const matches = column.type.match(/map<(\w+),\s*(\w+)>/i);
          const keyType = matches?.[1] ?? column.type;
          const valueType = matches?.[2] ?? column.type;
          let typeLine = `  ${snakeToCamel(column.column_name)}: Record<${
            MAPPER[keyType as ColumnTypes] || 'unknown'
          }, ${MAPPER[valueType as ColumnTypes] || 'unknown'}>;\n`;
          content += typeLine;
        } else if (column.type.includes('tuple')) {
          /** Tuples are similar to arrays of numbers */
          const matches = column.type.match(/tuple<([^>]+)>/i);
          if (!matches) return [];
          const types = matches[1]
            .split(',')
            .map((type) => MAPPER[type.trim() as ColumnTypes] || 'unknown');
          /**
           * Tuples have fixed length and types; use `readonly` to prevent
           * adding/removing elements. Reassignment of the entire tuple is still
           * allowed with `let`.
           */
          let typeLine = `  ${snakeToCamel(column.column_name)}: readonly [${types.join(
            ', ',
          )}];\n`;
          content += typeLine;
        } else if (column.type.includes('vector')) {
          /** Vectors are similar to arrays of numbers */
          content += `  ${snakeToCamel(column.column_name)}: number[];\n`;
        } else {
          /**
           * If the column type is unknown, use `unknown` and the user can add
           * it if they know
           */
          content += `  ${snakeToCamel(column.column_name)}: unknown;\n`;
        }
      } else {
        /**
         * If the column type is a native type, generate the type definition for
         * the column.
         */
        content += `  ${snakeToCamel(column.column_name)}: ${
          MAPPER[column.type]
        };\n`;
      }
    }
    content += `}\n\n`;

    /** Build PartitionKeys type */
    content += `type PartitionKeys = {\n${partitionKeyTypeDefinition.join(
      '\n',
    )}\n};\n\n`;

    /** Build ClusteringKeys type */
    if (clusteringKeys.length > 0) {
      content += `type ClusteringKeys =\n${clusteringKeysTypeDefinition};\n\n`;
    }

    /** Build object mapper for the table */
    content += `const mapper = new cassandra.mapping.Mapper(dbClient, {\n`;
    content += `  models: {\n`;
    content += `    ${interfaceName}: {\n`;
    content += `      tables: ['${tableName}'],\n`;
    content += `      mappings: new cassandra.mapping.UnderscoreCqlToCamelCaseMappings(),\n`;
    content += `      columns: {\n`;
    for (const column of columns) {
      content += getColumnMapper(column);
    }
    content += `      },\n`;
    content += `    },\n`;
    content += `  },\n`;
    content += `});\n\n`;

    /** Build mapper interface */
    content += `interface ${interfaceName}Mapper extends cassandra.mapping.ModelMapper<${interfaceName}> {\n`;
    content += `  get(\n`;
    content += `    doc: PartitionKeys${
      clusteringKeys.length > 0 ? ' & ClusteringKeys' : ''
    },\n`;
    content += `    docInfo?: { fields?: string[] },\n`;
    content += `    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,\n`;
    content += `  ): Promise<null | ${interfaceName}>;\n`;
    content += `}\n\n`;

    /** Export mapper */
    content += `const ${interfaceName} = mapper.forModel('${interfaceName}') as ${interfaceName}Mapper;\n`;
    content += `export default ${interfaceName};\n`;

    if (printOnly) {
      /** Print content to console only and apply syntax highlighting */
      highlightSyntax(content, 'typescript');
    } else {
      /** Write content to file */
      const filePath = path.join(modelsDir, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`Written ${fileName}`);
    }
  }
}

/**
 * List of native CQL types that map directly to JS/TS primitives and do not
 * require custom mapping.
 */
const nativeTypes: ColumnTypes[] = [
  'text',
  'varchar',
  'ascii',
  'tinyint',
  'smallint',
  'int',
  'timestamp',
  'float',
  'double',
  'boolean',
  'blob',
];

/**
 * Checks if a CQL type is a native collection type (`list`, `map`, or `set`)
 * which naturally serialize to JS arrays, objects, or sets without extra
 * mapping.
 *
 * @param type - The raw CQL column type string (e.g. "list<int>",
 *   "map<text,int>")
 * @returns `true` if the type is a collection type, else `false`.
 */
const isNativeCollectionType = (type: ColumnTypes) =>
  ['list', 'map', 'set'].some((t) => type.includes(t));

/**
 * Given a column definition, return a string containing the JavaScript object
 * (stringified) with two properties:
 *
 * - `name`: The camel-cased name of the column.
 * - `toModel`: A lambda function that takes the Cassandra-driver returned value
 *   and returns a JavaScript representation of the value. This is mostly useful
 *   for converting Cassandra types to JavaScript types that are not supported
 *   natively by the driver.
 *
 * @param column - The column definition from the Cassandra schema.
 * @returns A string containing the JavaScript object definition.
 */
function getColumnMapper(column: SchemaRow) {
  const type = column.type as ColumnTypes;
  if (nativeTypes.includes(type) || isNativeCollectionType(type)) {
    return ``; //return empty string. do not just `return;` since it will return undefined
  }

  let content = ``;
  content += `        ${column.column_name}: {\n`;
  content += `          name: '${snakeToCamel(column.column_name)}',\n`;
  content += `          toModel: ${getToModel(type)},\n`;
  content += `        },\n`;
  return content;
}
