import { expect, test } from '@playwright/test';

test('a two-player lobby can throw a die, skip by majority, and end by draw vote', async ({ page, browser }, info) => {
  test.setTimeout(55_000);
  await page.goto('/');
  await page.getByLabel('Display name').fill('Aki');
  await page.getByRole('button', { name: 'Create game', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(page.url());
    await guest.getByLabel('Display name').fill('Ren');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await expect(page.getByText('2 players connected')).toBeVisible();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(guest.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
    const starting = await page.getByRole('button', { name: 'Pass', exact: true }).isVisible() ? page : guest;
    const second = starting === page ? guest : page;
    for (let round = 0; round < 3; round++) {
      await starting.getByRole('button', { name: 'Pass', exact: true }).click();
      await second.getByRole('button', { name: 'Pass', exact: true }).click();
    }
    const die = starting.getByRole('button', { name: 'Throw 1 die' });
    await die.scrollIntoViewIfNeeded();
    const box = (await die.boundingBox())!;
    await starting.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await starting.mouse.down();
    await starting.mouse.move(box.x + box.width / 2 + 95, box.y + box.height / 2 + 45, { steps: 8 });
    await starting.mouse.up();
    if (process.env.MACHIKORO_TEST_URL) {
      const reference = second.getByRole('region', { name: 'Table references' });
      for (const step of ['roll', 'red', 'blue', 'green', 'purple', 'landmarks', 'allowance']) {
        await expect(reference.locator(`[data-category="${step}"]`)).toHaveAttribute('aria-current', 'step');
      }
    }
    await expect(second.getByRole('heading', { name: 'Build', exact: true })).toBeVisible({ timeout: 23_000 });

    await second.getByRole('button', { name: 'Table Controls' }).click();
    await second.getByRole('button', { name: 'Nudge', exact: true }).click();
    await second.getByRole('button', { name: 'Nudge ×1' }).click();
    await expect(starting.getByText('The table nudged you')).toBeVisible();
    await expect(starting.getByRole('complementary', { name: 'Table notifications' }).getByText('×2', { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Vote to skip turn' }).click();
    await expect(starting.getByText('Skip turn vote', { exact: true })).toBeVisible();
    await expect(starting.getByRole('heading', { name: 'Build', exact: true })).toBeVisible();
    await starting.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Throw 1 die' })).toBeVisible();

    await second.getByRole('button', { name: 'Vote to draw' }).click();
    await starting.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('draw-rankings.png') });
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(guest.getByRole('heading', { name: 'Opening round 1 of 3' })).toBeVisible();
  } finally {
    await guestContext.close();
  }
});
