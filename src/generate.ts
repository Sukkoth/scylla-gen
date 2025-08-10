import pluralize from 'pluralize';
import fs from 'fs/promises';
import path from 'path';
import {
  snakeToCamel,
  snakeToPascal,
  kebabCase,
  getToModel,
  MAPPER,
} from './utils';
import { fetchTableSchemas } from './service/db-service';
import { highlightSyntax } from './highlight-syntax';

type Props = {
  tables: string[];
  printOnly?: boolean;
  keyspace?: string;
};
export async function generateTypesAndMappers({
  tables,
  printOnly,
  keyspace,
}: Props) {
  const tableSchemas = await fetchTableSchemas(keyspace, tables);

  const modelsDir = path.resolve(process.cwd(), 'src/models');
  await fs.mkdir(modelsDir, { recursive: true });

  for (const table of tableSchemas) {
    const { tableName, columns } = table;
    const interfaceName = pluralize.singular(snakeToPascal(tableName));
    const fileName = kebabCase(interfaceName) + '.ts';

    // Build PartitionKeys type lines
    const partitionKeys = columns
      .filter((c) => c.kind === 'partition_key')
      .sort((a, b) => a.position - b.position);

    const partitionKeyLines = partitionKeys.map((c) => {
      if (c.column_name === 'bucket_id') {
        return `  ${snakeToCamel(c.column_name)}: ${
          MAPPER[c.type as keyof typeof MAPPER]
        };`;
      }
      return `  ${snakeToCamel(c.column_name)}: ${
        MAPPER[c.type as keyof typeof MAPPER]
      };`;
    });

    // Build ClusteringKeys union type (prefixes)
    const clusteringKeys = columns
      .filter((c) => c.kind === 'clustering')
      .sort((a, b) => a.position - b.position);

    let clusteringKeysUnion = '';
    if (clusteringKeys.length > 0) {
      const unions: string[] = [];
      for (let i = 1; i <= clusteringKeys.length; i++) {
        const keysSlice = clusteringKeys.slice(0, i);
        const typeLines = keysSlice
          .map(
            (c) =>
              `    ${snakeToCamel(c.column_name)}: ${
                MAPPER[c.type as keyof typeof MAPPER]
              };`,
          )
          .join('\n');
        unions.push(`  | {\n${typeLines}\n  }`);
      }
      clusteringKeysUnion = unions.join('\n');
    }

    let content = '';

    content += `import cassandra from 'cassandra-driver';\n`;
    content += `import { dbClient } from './db-client';\n\n`;

    content += `export interface ${interfaceName} {\n`;
    for (const column of columns) {
      content += `  ${snakeToCamel(column.column_name)}: ${
        MAPPER[column.type as keyof typeof MAPPER]
      };\n`;
    }
    content += `}\n\n`;

    content += `type PartitionKeys = {\n${partitionKeyLines.join(
      '\n',
    )}\n};\n\n`;

    if (clusteringKeys.length > 0) {
      content += `type ClusteringKeys =\n${clusteringKeysUnion};\n\n`;
    }

    content += `const mapper = new cassandra.mapping.Mapper(dbClient, {\n`;
    content += `  models: {\n`;
    content += `    ${interfaceName}: {\n`;
    content += `      tables: ['${tableName}'],\n`;
    content += `      mappings: new cassandra.mapping.UnderscoreCqlToCamelCaseMappings(),\n`;
    content += `      columns: {\n`;
    for (const column of columns) {
      if (
        column.type !== 'text' &&
        column.type !== 'varchar' &&
        column.type !== 'ascii'
      ) {
        content += `        ${column.column_name}: {\n`;
        content += `          name: '${snakeToCamel(column.column_name)}',\n`;
        content += `          toModel: ${getToModel(column.type)},\n`;
        content += `        },\n`;
      }
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

    if (printOnly) {
      highlightSyntax(content, 'typescript');
    } else {
      const filePath = path.join(modelsDir, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`Written ${fileName}`);
    }
  }
}
