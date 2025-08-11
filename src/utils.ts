import { ColumnTypes } from './types';
import { parse, highlight } from 'cli-highlight';
import * as fs from 'fs';
import readline from 'readline';
import path from 'path';

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function snakeToPascal(str: string): string {
  const camel = snakeToCamel(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function getToModel(type: ColumnTypes) {
  if (type === 'uuid') return '(val: cassandra.types.Uuid) => val.toString()';
  if (type === 'timeuuid')
    return '(val: cassandra.types.TimeUuid) => val.toString()';
  if (type === 'int' || type === 'counter') return '(val) => Number(val)';
  if (type === 'varint')
    return '(val: cassandra.types.Integer) => val.toNumber()';
  if (type === 'bigint') return '(val: cassandra.types.Long) => val.toNumber()';
  if (type === 'timestamp') return '(val) => new Date(val)';
  if (type === 'date')
    return '(val: cassandra.types.LocalDate) => val.toString()';
  if (type === 'decimal')
    return '(val: cassandra.types.BigDecimal) => val.toNumber()';
  if (type === 'duration')
    return '(val: cassandra.types.Duration) => val.toString()';
  if (type === 'inet')
    return '(val: cassandra.types.InetAddress) => val.toString()';
  if (type.includes('tuple')) {
    return '(val: cassandra.types.Tuple) => val.elements';
  }
  if (type === 'time')
    return '(val: cassandra.types.LocalTime) => val.toString()';
  if (type.includes('vector')) {
    return '(val: cassandra.types.Vector) => val.elements';
  }

  console.log('unknown type', type);
  return '(val) => val';
}

export function safeCallSync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  ...args: TArgs
): [null, TResult] | [Error] {
  try {
    return [null, fn(...args)];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e))] as [Error];
  }
}

export async function safeCall<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  ...args: TArgs
): Promise<[null, TResult] | [Error]> {
  return fn(...args)
    .then((res) => [null, res] as [null, TResult])
    .catch((e) => [e instanceof Error ? e : new Error(String(e))] as [Error]);
}

export function highlightSyntax(
  content: string,
  language: 'typescript' | 'sql',
) {
  const theme = fs.readFileSync('./syntax-highlight-theme.json', 'utf8');
  const code = highlight(content, {
    language,
    theme: parse(theme),
  });
  console.log(code);
}

export function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function writeFileSafely(
  filePath: string,
  content: string,
  checkExists = true,
  exitOnNoOverwrite = true,
) {
  if (checkExists && fs.existsSync(filePath)) {
    const answer = await askQuestion(
      `File ${filePath} already exists. Overwrite? (y/N): `,
    );
    if (answer.toLowerCase() !== 'y') {
      if (exitOnNoOverwrite) process.exit(0);
      return 'aborted';
    }
    return 'overwritten';
  } else {
    // Ensure the parent directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const [error] = safeCallSync(() =>
    fs.writeFileSync(filePath, content, { flag: 'w' }),
  );
  if (error) {
    console.error(`Error occurred while writing file: ${error.message}`);
    process.exit(1);
  }
  return 'written';
}
