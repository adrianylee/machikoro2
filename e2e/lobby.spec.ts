import { expect, test } from '@playwright/test';

test('create a private room, join from a second browser, chat and recover the guest seat', async ({ page, browser, baseURL }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Machi Koro 2' })).toBeVisible();
  await expect(page.locator('.city-art img')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('home.png') });
  await page.getByRole('textbox', { name: 'Display name' }).fill('Aki');
  await page.getByRole('button', { name: 'Create game', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  const invite = page.url();
  expect(invite).toMatch(/\/room\/[a-f0-9]{32}$/);

  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const guest = await phone.newPage();
    await guest.goto(invite);
    await guest.getByRole('textbox', { name: 'Display name' }).fill('Ren');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await expect(page.getByText('Ren', { exact: true })).toBeVisible();

    await guest.getByRole('textbox', { name: 'Chat message' }).fill('Ready to build!');
    await guest.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Ready to build!')).toBeVisible();
    await guest.reload();
    await expect(guest.getByText('Ren (you)', { exact: true })).toBeVisible();
    await expect(guest.getByText('Ready to build!')).toBeVisible();

    if (!await guest.getByRole('button', { name: 'Switch to light mode' }).isVisible()) {
      await guest.getByRole('button', { name: 'Switch to dark mode' }).click();
    }
    await expect(guest.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath('desktop-lobby.png'), fullPage: true });
    await guest.screenshot({ path: info.outputPath('mobile-lobby.png'), fullPage: true });
  } finally {
    await phone.close();
  }
});
