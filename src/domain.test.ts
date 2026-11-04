import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, officialUrl } from './domain.ts';
test('preserva precisão de dia sem fabricar horário limite', () => {
  assert.equal(daysUntil('2026-11-05', new Date(2026, 10, 4, 23, 30)), 1);
  assert.equal(daysUntil('2026-11-04', new Date(2026, 10, 4)), 0);
});
test('não aceita protocolos executáveis ou credenciais em links', () => {
  assert.throws(() => officialUrl('javascript:alert(1)'));
  assert.throws(() => officialUrl('https://user:pass@example.com'));
  assert.equal(officialUrl('https://example.com'), 'https://example.com/');
});
