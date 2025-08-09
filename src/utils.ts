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
