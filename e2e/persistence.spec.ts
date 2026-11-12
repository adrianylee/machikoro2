import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { expect, test } from '@playwright/test';

test('room state and credentials survive a Worker process restart', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a test port.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const persistence = info.outputPath('worker-state');
  let child: ReturnType<typeof spawn> | undefined;
  let output = '';

  async function start() {
    output = '';
    child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--ip', '127.0.0.1',
      '--port', String(port), '--persist-to', persistence, '--inspector-port', '0'],
    { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout?.on('data', chunk => { output += chunk; });
    child.stderr?.on('data', chunk => { output += chunk; });
    try {
      await expect.poll(async () => {
        if (child?.exitCode != null) throw new Error(`Worker exited with code ${child.exitCode}.`);
        try {
          return (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })).status;
        } catch {
          return 0;
        }
      }, { timeout: 30000 }).toBe(200);
    } catch (cause) {
      throw new Error(`The test Worker did not become healthy.\n${output.slice(-6000)}`, { cause });
    }
  }

  async function stop() {
    const current = child;
    child = undefined;
    if (!current || current.exitCode !== null || current.signalCode !== null) return;
    const done = once(current, 'exit');
    current.kill('SIGTERM');
    await done;
  }

  const guestContext = await browser.newContext();
  try {
    await start();
    await page.goto(origin);
    await page.getByLabel('Display name').fill('Aki');
    await page.getByRole('button', { name: 'Create game', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
    const invite = page.url();
    const guest = await guestContext.newPage();
    await guest.goto(invite);
    await guest.getByLabel('Display name').fill('Ren');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(guest.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    const active = await page.getByRole('button', { name: 'Pass', exact: true }).isVisible() ? page : guest;
    await active.getByRole('button', { name: 'Pass', exact: true }).click();
    await page.getByRole('button', { name: 'Game Log', exact: true }).click();
    await expect(page.getByText('passes.', { exact: false })).toBeVisible();
    await stop();
    await start();

    await Promise.all([page.reload(), guest.reload()]);
    await expect(page.getByText('Aki (you)', { exact: true })).toBeVisible();
    await expect(guest.getByText('Ren (you)', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    await page.getByRole('button', { name: 'Game Log', exact: true }).click();
    await expect(page.getByText('passes.', { exact: false })).toBeVisible();
  } finally {
    await guestContext.close();
    await stop();
  }
});
