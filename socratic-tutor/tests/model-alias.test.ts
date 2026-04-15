import { test, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BANNED_MODELS = [
  "claude-3-5-sonnet-latest",
  "claude-3-haiku-20240307",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620"
];

function scanDirectory(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(scanDirectory(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  return results;
}

test('Ensure no banned Anthropic models are used in the codebase', () => {
  const apiDir = path.resolve(process.cwd(), 'src/app/api');
  const files = scanDirectory(apiDir);
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const bannedModel of BANNED_MODELS) {
      if (content.includes(bannedModel)) {
        assert.fail(`Banned Anthropic model alias "${bannedModel}" found in file: ${file}`);
      }
    }
  }
});
