import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { CARDS } from '../src/game/catalog.ts';
import { TABLE_CARDS } from '../src/game/view.ts';

test('all 40 card illustrations resolve to distinct local WebP assets', async () => {
  const names = await readdir(new URL('../public/art/', import.meta.url));
  const expected = Object.keys(CARDS).map(id => `${id}.webp`);
  assert.deepEqual(names.sort(), expected.sort());
  for (const id of Object.keys(CARDS)) {
    assert.equal(TABLE_CARDS[id].art, `/art/${id}.webp`);
    const data = await readFile(new URL(`../public/art/${id}.webp`, import.meta.url));
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    assert.ok(data.length > 1024);
  }
});
