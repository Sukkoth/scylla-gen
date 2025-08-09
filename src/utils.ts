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

export function getToModel(type: string) {
  if (type === 'uuid' || type === 'text') return '(val) => val.toString()';
  if (type === 'int' || type === 'counter') return '(val) => Number(val)';
  if (type === 'timestamp') return '(val) => new Date(val)';
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

export const MAPPER = {
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
