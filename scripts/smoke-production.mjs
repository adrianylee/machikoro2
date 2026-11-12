import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';

const entries = (await readFile(process.argv[2], 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const deployment = entries.findLast(entry => entry.type === 'deploy' && entry.worker_name === 'machikoro2');
assert.ok(deployment, 'Wrangler did not report a machikoro2 deployment.');
const target = deployment.targets.find(value => typeof value === 'string' && value.startsWith('https://'));
assert.ok(target, 'Wrangler did not report an HTTPS deployment URL.');
const base = new URL(target);
const timeout = () => ({ signal: AbortSignal.timeout(10_000) });
let error;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const health = await fetch(new URL('/api/health', base), timeout());
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const home = await fetch(base, timeout());
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<title>Machi Koro 2<\/title>/);
    const art = await fetch(new URL('/art/radio-tower.webp', base), timeout());
    assert.equal(art.status, 200);
    assert.equal(art.headers.get('content-type'), 'image/webp');
    const result = `Cloudflare Worker ${deployment.version_id ?? ''} verified at ${base.href}`;
    console.log(result);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${result}\n`);
    process.exit(0);
  } catch (reason) {
    error = reason;
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 4000));
  }
}
throw error;
