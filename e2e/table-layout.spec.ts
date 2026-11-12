import { expect, test } from '@playwright/test';

test('table presents market, cities and readable card details on desktop and a phone', async ({ page }, info) => {
  const roomId = 'a'.repeat(32);
  await page.addInitScript(id => {
    localStorage.setItem(`machi-seat:${id}`, 'a'.repeat(64));
  }, roomId);
  await page.routeWebSocket(`**/api/rooms/${roomId}`, socket => {
    socket.onMessage(() => socket.send(JSON.stringify({
      type: 'room', self: 'aki', hostId: 'aki',
      players: [{ id: 'aki', name: 'Aki', online: true }, { id: 'ren', name: 'Ren', online: true }],
      chat: [],
      game: {
        phase: 'opening', openingRound: 2, activePlayerId: 'aki',
        supply: {
          low: { remaining: 27, stacks: [{ id: 'bakery', count: 3 }, { id: 'wheat-field', count: 1 }] },
          high: { remaining: 0, stacks: [] },
          landmarks: { remaining: 15, stacks: [{ id: 'radio-tower', count: 1 }] },
        },
        cities: [
          { id: 'aki', name: 'Aki', coins: 4, establishments: [{ id: 'wheat-field', count: 1 }], landmarks: [] },
          { id: 'ren', name: 'Ren', coins: 4, establishments: ['bakery', 'vineyard', 'forest', 'cafe', 'wheat-field', 'mine'].map(id => ({ id, count: id === 'vineyard' ? 2 : 1 })), landmarks: [] },
        ],
        legalBuilds: { bakery: { cost: 1 }, 'wheat-field': { cost: 1 }, 'radio-tower': { cost: 12, blocked: 'Landmarks open after the initial building rounds.' } },
      },
    })));
  });
  await page.goto(`/room/${roomId}`);
  await expect(page.getByRole('heading', { name: 'Opening round 2 of 3' }).first()).toBeVisible();
  const market = page.getByRole('region', { name: 'Market' });
  await expect(market.getByRole('group', { name: 'Bakery, 3 copies' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('table-desktop.png'), fullPage: true });
  await market.getByRole('group', { name: 'Bakery, 3 copies' }).hover();
  const details = page.getByRole('region', { name: 'Bakery details' });
  await expect(details.getByText('Activates on 2 or 3')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Buy Bakery for 1 coin' })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('expanded-card.png') });
  await market.getByRole('group', { name: 'Wheat Field', exact: true }).hover();
  await expect(page.getByRole('region', { name: 'Wheat Field details' })).toBeVisible();
  await expect(details).toBeHidden();
  await page.keyboard.press('Escape');
  await market.getByRole('group', { name: 'Radio Tower, unaffordable' }).hover();
  const landmark = page.getByRole('region', { name: 'Radio Tower details' });
  await expect(landmark.getByText(/12 \/ 16 \/ 22/)).toBeVisible();
  await expect(landmark.getByRole('button')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'View Ren' }).click();
  await expect(page.getByRole('region', { name: 'Player city' }).getByRole('heading', { name: 'Ren’s city' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Ren' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'City property summary' }).getByLabel('Fruit, 2 cards').hover();
  await expect(page.getByRole('region', { name: 'Fruit properties' }).getByText('Vineyard ×2')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Turn controls' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const cityCards = page.getByRole('region', { name: 'Player city' }).locator('.card-row');
  await cityCards.scrollIntoViewIfNeeded();
  await cityCards.hover();
  await page.mouse.wheel(0, 180);
  await expect.poll(() => cityCards.evaluate(row => row.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('table-phone.png') });
});
