import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const values = property => [...new Set([...css.matchAll(new RegExp(`(?<![\\w-])${property}:([^;}]+)`, 'g'))].map(match => match[1].trim()))];
assert.deepEqual(values('gap').sort(), ['var(--gap-lg)', 'var(--gap-md)', 'var(--gap-sm)'].sort());
assert(values('font-weight').every(value => ['400', '500', '700', 'var(--weight-regular)'].includes(value)));
assert(values('font-size').every(value => /^\d+px$/.test(value) ? parseInt(value) % 8 === 0 : /^var\(--font-/.test(value)));
assert.equal((css.match(/background:var\(--primary\)/g) || []).length, 1);
console.log('Tokens verificados: 3 gaps, 3 pesos, fontes em múltiplos de 8 e primária no botão principal.');
