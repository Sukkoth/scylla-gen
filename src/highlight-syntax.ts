import { parse, highlight } from 'cli-highlight';
import * as fs from 'fs';
const theme = fs.readFileSync('./syntax-highlight-theme.json', 'utf8');

export function highlightSyntax(
  content: string,
  language: 'typescript' | 'sql'
) {
  const code = highlight(content, {
    language,
    theme: parse(theme),
  });
  console.log(code);
}
