import { cassandraClient } from './cassandra-models/cassandra-client';
import { types as cassandraTypes } from 'cassandra-driver';
import pluralize from 'pluralize';
import fs from 'fs/promises';
import path from 'path';

import { snakeToCamel, snakeToPascal, kebabCase, getToModel } from './utils';

const mapper = {
  ascii: 'string',
  bigint: 'number',
  blob: 'Buffer',
  boolean: 'boolean',
  counter: 'number',
  date: 'string',
  decimal: 'number',
  double: 'number',
  duration: 'string',
  float: 'number',
  inet: 'string',
  int: 'number',
  list: 'array',
  map: 'object',
  set: 'set',
  smallint: 'number',
  text: 'string',
  time: 'string',
  timestamp: 'Date',
  timeuuid: 'string',
  tinyint: 'number',
  tuple: 'tuple',
  uuid: 'string',
  varchar: 'string',
  varint: 'number',
  vector: 'vector',
};
function mapTypes(columnType: keyof typeof cassandraTypes.dataTypes) {
  return mapper[columnType as keyof typeof mapper];
}

async function getTableColumns() {
  const tableNames = await cassandraClient.execute(
    `SELECT table_name, column_name, kind, position, type FROM system_schema.columns WHERE keyspace_name = 'messaging_service';`,
    {},
    {
      prepare: true,
    }
  );

  const tables: {
    [tableName: string]: {
      columns: {
        kind: 'regular' | 'clustering' | 'partition_key';
        position: number;
        type: keyof typeof cassandraTypes.dataTypes;
        mappedType: (typeof mapper)[keyof typeof mapper];
        name: string;
      }[];
    };
  } = {};

  for (const row of tableNames.rows) {
    if (!tables[row.table_name]) {
      tables[row.table_name] = {
        columns: [],
      };
    }
    tables[row.table_name].columns.push({
      kind: row.kind,
      position: row.position,
      type: row.type,
      mappedType: mapTypes(row.type)!,
      name: row.column_name,
    });
  }

  return tables;
}

export async function generateTypesAndMappers() {
  const tables = await getTableColumns();

  const modelsDir = path.resolve(process.cwd(), 'src/cassandra-models');
  await fs.mkdir(modelsDir, { recursive: true });

  for (const [tableName, table] of Object.entries(tables)) {
    const interfaceName = pluralize.singular(snakeToPascal(tableName));
    const fileName = kebabCase(interfaceName) + '.ts';

    // Build PartitionKeys type lines
    const partitionKeys = table.columns
      .filter((c) => c.kind === 'partition_key')
      .sort((a, b) => a.position - b.position);

    const partitionKeyLines = partitionKeys.map((c) => {
      if (c.name === 'bucket_id') {
        return `  ${snakeToCamel(
          c.name
        )}: \`\${number}-\${number}-\${number}-\${number}\`;`;
      }
      return `  ${snakeToCamel(c.name)}: ${c.mappedType};`;
    });

    // Build ClusteringKeys union type (prefixes)
    const clusteringKeys = table.columns
      .filter((c) => c.kind === 'clustering')
      .sort((a, b) => a.position - b.position);

    let clusteringKeysUnion = '';
    if (clusteringKeys.length > 0) {
      const unions: string[] = [];
      for (let i = 1; i <= clusteringKeys.length; i++) {
        const keysSlice = clusteringKeys.slice(0, i);
        const typeLines = keysSlice
          .map((c) => `    ${snakeToCamel(c.name)}: ${c.mappedType};`)
          .join('\n');
        unions.push(`  | {\n${typeLines}\n  }`);
      }
      clusteringKeysUnion = unions.join('\n');
    }

    let content = '';

    content += `import cassandra from 'cassandra-driver';\n`;
    content += `import { cassandraClient } from './cassandra-client';\n\n`;

    content += `export interface ${interfaceName} {\n`;
    for (const column of table.columns) {
      content += `  ${snakeToCamel(column.name)}: ${column.mappedType};\n`;
    }
    content += `}\n\n`;

    content += `type PartitionKeys = {\n${partitionKeyLines.join(
      '\n'
    )}\n};\n\n`;

    if (clusteringKeys.length > 0) {
      content += `type ClusteringKeys =\n${clusteringKeysUnion};\n\n`;
    }

    content += `const mapper = new cassandra.mapping.Mapper(cassandraClient, {\n`;
    content += `  models: {\n`;
    content += `    ${interfaceName}: {\n`;
    content += `      tables: ['${tableName}'],\n`;
    content += `      mappings: new cassandra.mapping.UnderscoreCqlToCamelCaseMappings(),\n`;
    content += `      columns: {\n`;
    for (const column of table.columns) {
      content += `        ${column.name}: {\n`;
      content += `          name: '${snakeToCamel(column.name)}',\n`;
      content += `          toModel: ${getToModel(column.type)},\n`;
      content += `        },\n`;
    }
    content += `      },\n`;
    content += `    },\n`;
    content += `  },\n`;
    content += `});\n\n`;

    content += `interface ${interfaceName}Mapper extends cassandra.mapping.ModelMapper<${interfaceName}> {\n`;
    content += `  get(\n`;
    content += `    doc: PartitionKeys${
      clusteringKeys.length > 0 ? ' & ClusteringKeys' : ''
    },\n`;
    content += `    docInfo?: { fields?: string[] },\n`;
    content += `    executionOptions?: string | cassandra.mapping.MappingExecutionOptions,\n`;
    content += `  ): Promise<null | ${interfaceName}>;\n`;
    content += `}\n\n`;

    content += `const ${interfaceName} = mapper.forModel('${interfaceName}') as ${interfaceName}Mapper;\n`;
    content += `export default ${interfaceName};\n`;

    const filePath = path.join(modelsDir, fileName);
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Written ${fileName}`);
  }
}
