import { expect, test } from '@playwright/test';

test('password protection, lobby removal and sound settings work in independent browsers', async ({ page, browser, baseURL }) => {
  await page.goto('/');
  await page.getByLabel('Display name').fill('Host');
  await page.getByLabel('Room password').fill('painted city');
  await page.getByRole('button', { name: 'Create game', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await page.getByRole('button', { name: 'Mute game sounds' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enable game sounds' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();

  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  try {
    const guest = await context.newPage();
    await guest.goto(page.url());
    await guest.getByLabel('Display name').fill('Guest');
    await guest.getByLabel('Room password').fill('wrong');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await expect(guest.getByRole('alert')).toHaveText('Enter the room password to join.');
    await expect(page.getByRole('button', { name: 'Remove Guest' })).toHaveCount(0);
    await guest.getByLabel('Display name').fill('Guest');
    await guest.getByLabel('Room password').fill('painted city');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await expect(guest.getByRole('heading', { name: 'Lobby' })).toBeVisible();
    await guest.reload();
    await expect(guest.getByText('Guest (you)', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Remove Host' })).toHaveCount(0);
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByRole('button', { name: 'Remove Guest' }).click();
    await page.getByRole('dialog', { name: 'Remove player' }).getByRole('button', { name: 'Remove player' }).click();
    await expect(guest.getByRole('alert')).toHaveText('The host removed your seat.');
    await expect(page.getByRole('button', { name: 'Remove Guest' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
